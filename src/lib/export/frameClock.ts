/**
 * Deterministic time and randomness for export.
 *
 * Preview runs on the wall clock and Math.random. While an export is active the scene
 * reads its time from the frame number and draws random numbers from a PRNG that is
 * seeded by the frame number, so exporting the same settings twice gives the same frames.
 *
 * The post-processing library (glitch effect seeds and offsets) calls Math.random directly
 * while it renders. Math.random is therefore replaced only for the synchronous duration of
 * one frame's render (withSeededRandom), so nothing else in the page can draw from the
 * seeded stream or be affected by it.
 */

let active = false;
let time = 0;
let rng: () => number = Math.random;

/** mulberry32: small, fast, good enough for visual randomness. */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Seed derived from the frame number. */
function seedFor(frame: number, phase: number): number {
    return (Math.imul(frame + 1, 2654435761) ^ Math.imul(phase + 1, 0x85ebca6b)) >>> 0;
}

export function beginDeterministic(): void {
    active = true;
    time = 0;
}

export function endDeterministic(): void {
    active = false;
}

/** Set the export time (seconds) and restart the PRNG for this frame. */
export function setFrame(frame: number, seconds: number): void {
    time = seconds;
    rng = mulberry32(seedFor(frame, 0));
}

/** Run fn (synchronously) with Math.random replaced by the current frame's seeded stream. */
export function withSeededRandom<T>(fn: () => T): T {
    const original = Math.random;
    Math.random = () => rng();
    try {
        return fn();
    } finally {
        Math.random = original;
    }
}

export function isExportActive(): boolean {
    return active;
}

export function getExportTime(): number {
    return time;
}

/** Random number for scene code: seeded while exporting, Math.random otherwise. */
export function frameRandom(): number {
    return active ? rng() : Math.random();
}
