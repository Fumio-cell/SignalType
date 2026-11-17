import * as THREE from 'three';
import { PARAM_BY_ID } from '@/lib/automation/params';
import { EXPORT_SIZES, useExportResolution } from '@/lib/export/stage';

/**
 * FIT: the largest SIZE at which the text at rest sits inside the middle 88 % of the frame on both axes.
 *
 * Nothing here looks at the window or at a canvas. The scene hands over the box the text occupies in the
 * scene's own units (the geometry, with the float, shake and beat taken off), and the box is seen through the
 * stage camera with the aspect of the export frame, which is the aspect the stage is letterboxed to. So the
 * answer is a function of the text, the font and the settings alone, like an export.
 */

/** Clear space on each side of the frame, as a fraction of its width / height. */
export const FIT_MARGIN = 0.06;
/** SIZE is written on this grid, rounded down so the text is never over the margin. Fine enough to land within a percent of the margin at the smallest sizes. */
export const FIT_STEP = 0.001;

/** What the scene knows about the text at rest, at the size it is drawn with now. */
export interface RestBox {
    /** The SIZE the box was measured at. */
    size: number;
    /** Distance the bevel adds to the outline on every side. It does not grow with SIZE; everything else does. */
    bevel: number;
    /** Box of the text in scene units, with the animation of the float, the shake and the beat taken off. */
    min: THREE.Vector3;
    max: THREE.Vector3;
    /** The stage camera. Only its position and field of view are used. */
    camera: THREE.Camera;
}

type Probe = () => RestBox | null;

let probe: Probe | null = null;

/** The scene registers how to measure the text; returns the function that removes it again. */
export function registerFitProbe(p: Probe | null): () => void {
    probe = p;
    return () => {
        if (probe === p) probe = null;
    };
}

/** Whether the text fits at `size` (the box measured at box.size, scaled to `size`). */
function fitsAt(box: RestBox, cam: THREE.PerspectiveCamera, size: number): boolean {
    const k = size / box.size;
    const b = box.bevel;
    const x0 = k * (box.min.x + b) - b;
    const x1 = k * (box.max.x - b) + b;
    const y0 = k * (box.min.y + b) - b;
    const y1 = k * (box.max.y - b) + b;
    const v = new THREE.Vector3();
    const lim = 1 - 2 * FIT_MARGIN;
    for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? box.max.z : box.min.z).project(cam);
        if (Math.abs(v.x) > lim || Math.abs(v.y) > lim) return false;
    }
    return true;
}

/** The SIZE for a measured box, or the smallest / largest SIZE when none / every one fits. */
export function sizeToFit(box: RestBox): number {
    const { min: lo0, max: hi0 } = PARAM_BY_ID.size;
    const frame = EXPORT_SIZES[useExportResolution.getState().resolution];
    const cam = (box.camera as THREE.PerspectiveCamera).clone();
    cam.aspect = frame.width / frame.height;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);

    if (fitsAt(box, cam, hi0)) return hi0;
    if (!fitsAt(box, cam, lo0)) return lo0;
    let lo = lo0;
    let hi = hi0;
    for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (fitsAt(box, cam, mid)) lo = mid;
        else hi = mid;
    }
    const grid = (n: number) => Number((n * FIT_STEP).toFixed(3));
    let n = Math.floor(lo / FIT_STEP + 1e-9);
    while (n > Math.round(lo0 / FIT_STEP) && !fitsAt(box, cam, grid(n))) n--;
    return Math.max(lo0, Math.min(hi0, grid(n)));
}

/** The SIZE that fits the text now, or null when the scene has no text to measure yet. */
export function computeFit(): number | null {
    const box = probe?.() ?? null;
    return box ? sizeToFit(box) : null;
}
