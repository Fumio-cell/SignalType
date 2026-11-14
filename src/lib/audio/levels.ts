/**
 * Values read straight from the decoded audio at a point in time. They depend on the time alone (no
 * state is kept between frames), so the preview and every export of the same file give the same numbers.
 */

import { normalizedOnsets } from './schedule';

const HOP = 512; // analysis hop of src/workers/analysis* (FFT 2048 / 4)

/**
 * How far audio reaches into the picture: the "Audio burst gain" slider, 1 at its default of 1.5. At 0 nothing in
 * the picture depends on the audio.
 */
export const BURST_GAIN_DEFAULT = 1.5;
export function audioReach(burstGain: number): number {
    return Math.max(0, burstGain) / BURST_GAIN_DEFAULT;
}

/** Loudness around `time`, 0 (silence) .. 1 (loud): RMS over 60 ms, -40 dB .. -10 dB. */
export function loudness(buffer: AudioBuffer | null, time: number): number {
    if (!buffer) return 0;
    const data = buffer.getChannelData(0);
    const window = Math.round(buffer.sampleRate * 0.06);
    const end = Math.min(data.length, Math.max(0, Math.round(time * buffer.sampleRate) + (window >> 1)));
    const start = Math.max(0, end - window);
    if (end <= start) return 0;
    let sum = 0;
    for (let i = start; i < end; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / (end - start));
    const db = 20 * Math.log10(Math.max(rms, 1e-6));
    return Math.min(1, Math.max(0, (db + 40) / 30));
}

/**
 * How recently and how hard a beat hit: the largest recent onset, fading over about 120 ms.
 * 0 when nothing hit, about 1 right on a strong onset.
 */
export function beatEnvelope(onsetStrength: Float32Array | null, buffer: AudioBuffer | null, time: number): number {
    if (!onsetStrength || !buffer) return 0;
    const FFT = 2048;
    const onsets = normalizedOnsets(onsetStrength);
    const frame = Math.floor((time * buffer.sampleRate - FFT) / HOP);
    const hopSeconds = HOP / buffer.sampleRate;
    let best = 0;
    for (let k = 0; k < 24; k++) {
        const i = frame - k;
        if (i < 0) break;
        if (i >= onsets.length) continue;
        const v = onsets[i] * Math.exp(-(k * hopSeconds) / 0.12);
        if (v > best) best = v;
    }
    return best;
}
