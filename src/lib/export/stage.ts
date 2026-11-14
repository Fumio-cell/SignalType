import { create } from 'zustand';
import type { EffectComposer as EffectComposerImpl } from 'postprocessing';

/**
 * True while an export owns the renderer. The Canvas takes its frameloop and dpr from this, because
 * the Canvas re-applies its props to the renderer whenever it re-renders, which would otherwise
 * switch the live loop back on in the middle of an export.
 */
export const useExportMode = create<{ active: boolean }>(() => ({ active: false }));

export type ExportResolution = '1080p' | '4K';

/** Pixel size of each export resolution. Both are 16:9. */
export const EXPORT_SIZES: Record<ExportResolution, { width: number; height: number }> = {
    '1080p': { width: 1920, height: 1080 },
    '4K': { width: 3840, height: 2160 },
};

/**
 * The resolution chosen in the export panel. The preview reads it too: the stage is letterboxed to
 * this aspect ratio, so the framing on screen is the framing of the exported frame.
 */
export const useExportResolution = create<{ resolution: ExportResolution; set: (r: ExportResolution) => void }>((set) => ({
    resolution: '1080p',
    set: (resolution) => set({ resolution }),
}));

/** What exportVideo needs from the live stage. Registered by components/canvas/ExportBridge. */
export interface ExportStage {
    /** Switch the renderer to exactly width x height device pixels (DPR 1) and stop the live loop. */
    begin(width: number, height: number): Promise<void>;
    /** Render frame `frame` at `fps` deterministically and return the canvas holding it. */
    renderFrame(frame: number, fps: number): Promise<HTMLCanvasElement>;
    /** Restore the live size, DPR and loop. */
    end(): Promise<void>;
}

let current: ExportStage | null = null;

export function setExportStage(stage: ExportStage | null): void {
    current = stage;
}

export function getExportStage(): ExportStage | null {
    return current;
}

/** The post-processing composer, registered by PostFX so the export can size its buffers. */
export type ResizableComposer = EffectComposerImpl;

let composer: ResizableComposer | null = null;

export function registerComposer(c: ResizableComposer | null): void {
    composer = c;
}

export function getComposer(): ResizableComposer | null {
    return composer;
}
