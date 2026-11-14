/**
 * When the lines of the sequence change. A list of switch times is computed once from the onset envelope and the
 * settings; the line at any time t is then read off that list. Nothing is accumulated from frame to frame, so
 * the line at t is a pure function of (envelope, settings, t): an export, a seek and a replay all agree.
 *
 * The rule:
 *  - the first line is on from t = 0;
 *  - the next switch is the first onset peak above the threshold that comes at least `dwell` after the last switch;
 *  - if no such peak comes within three times `dwell` of the last switch, the switch happens then anyway.
 */

const HOP = 512; // analysis hop (src/workers/analysisWorker.ts: FFT 2048 / 4)
const FFT = 2048;

/**
 * Where the onset peak of an analysis frame sits in time, as a fraction of its window. Measured on test clicks of known
 * time (spectral flux with a Hann window): the peak frame's window start plus 0.6 of the window length lands within 6 ms
 * of the click.
 */
const PEAK_IN_WINDOW = 0.6;

const normalizedCache = new WeakMap<Float32Array, Float32Array>();
const maximaCache = new WeakMap<Float32Array, { frame: number; value: number }[]>();

/**
 * The onset envelope scaled so that its strongest onset is 1. The worker normalizes by the largest value of the
 * whole array, which for most music is the first frame (the spectrum "grows" from nothing); that frame is left out here.
 */
export function normalizedOnsets(onsets: Float32Array): Float32Array {
    let out = normalizedCache.get(onsets);
    if (out) return out;
    let max = 0;
    for (let i = 1; i < onsets.length; i++) if (Number.isFinite(onsets[i]) && onsets[i] > max) max = onsets[i];
    out = new Float32Array(onsets.length);
    if (max > 1e-6) {
        for (let i = 1; i < onsets.length; i++) out[i] = Number.isFinite(onsets[i]) ? Math.min(1, onsets[i] / max) : 0;
    }
    normalizedCache.set(onsets, out);
    return out;
}

/** The local maxima of the normalized envelope: one entry per onset, the first frame of a flat top. */
function localMaxima(onsets: Float32Array): { frame: number; value: number }[] {
    let out = maximaCache.get(onsets);
    if (out) return out;
    const n = normalizedOnsets(onsets);
    out = [];
    for (let f = 1; f < n.length; f++) {
        const v = n[f];
        if (v <= 0) continue;
        let peak = true;
        for (let k = 1; k <= 2 && peak; k++) {
            if (f - k >= 0 && n[f - k] > v) peak = false;
            if (f + k < n.length && n[f + k] >= v) peak = false;
        }
        if (peak) out.push({ frame: f, value: v });
    }
    maximaCache.set(onsets, out);
    return out;
}

export function peakTime(frame: number, sampleRate: number): number {
    return (frame * HOP + PEAK_IN_WINDOW * FFT) / sampleRate;
}

/** Times (seconds) at which the line changes, in order, up to `duration`. Empty when `duration` is not positive. */
export function computeSwitchTimes(
    onsets: Float32Array | null,
    sampleRate: number,
    duration: number,
    threshold: number,
    dwell: number,
): number[] {
    const times: number[] = [];
    if (!(duration > 0) || !(dwell > 0)) return times;
    const peaks = onsets && sampleRate > 0
        ? localMaxima(onsets).filter((p) => p.value >= threshold).map((p) => peakTime(p.frame, sampleRate))
        : [];
    let last = 0;
    let i = 0;
    for (;;) {
        const forced = last + 3 * dwell;
        while (i < peaks.length && peaks[i] < last + dwell) i++;
        const next = i < peaks.length && peaks[i] <= forced ? peaks[i] : forced;
        if (next >= duration) break;
        times.push(next);
        last = next;
    }
    return times;
}

export interface SequenceState {
    /** Which line is shown: the number of switches so far, modulo the number of lines. */
    index: number;
    /** When the current line came on. */
    last: number;
    /** When the next switch happens (the forced one when the list is exhausted). */
    next: number;
}

/** Read the sequence at time t off a list of switch times. */
export function sequenceAt(times: number[], t: number, lineCount: number, dwell: number): SequenceState {
    // number of switch times <= t
    let lo = 0;
    let hi = times.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (times[mid] <= t) lo = mid + 1;
        else hi = mid;
    }
    const last = lo > 0 ? times[lo - 1] : 0;
    const next = lo < times.length ? times[lo] : last + 3 * dwell;
    return { index: lineCount > 0 ? lo % lineCount : 0, last, next };
}

let cache: { key: unknown[]; times: number[] } | null = null;

/** The switch times for the audio that is loaded and the current settings; recomputed only when one of them changed. */
export function getSwitchTimes(
    onsets: Float32Array | null,
    sampleRate: number,
    duration: number,
    threshold: number,
    dwell: number,
): number[] {
    const key = [onsets, sampleRate, duration, threshold, dwell];
    if (cache && cache.key.every((v, i) => v === key[i])) return cache.times;
    const times = computeSwitchTimes(onsets, sampleRate, duration, threshold, dwell);
    cache = { key, times };
    return times;
}
