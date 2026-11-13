import { create } from 'zustand';

/**
 * True while an export owns the renderer. The Canvas takes its frameloop and dpr from this, because
 * the Canvas re-applies its props to the renderer whenever it re-renders, which would otherwise
 * switch the live loop back on in the middle of an export.
 */
export const useExportMode = create<{ active: boolean }>(() => ({ active: false }));

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
export interface ResizableComposer {
    setSize(width: number, height: number, updateStyle?: boolean): void;
}

let composer: ResizableComposer | null = null;

export function registerComposer(c: ResizableComposer | null): void {
    composer = c;
}

export function getComposer(): ResizableComposer | null {
    return composer;
}
