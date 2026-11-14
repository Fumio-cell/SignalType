/**
 * Automation: a knob's movement over the track, recorded while playing and read back by time.
 *
 * It is data on a time axis in seconds, not a recording of the screen. An export reads every curve at the exact frame time
 * t = frame / fps, so a frame is still a pure function of (audio envelope, settings, automation, t).
 */

/** The eight knobs that can be automated. Nothing that changes structure (resolution, format, font, text, vertical, 2D/3D, look) is on this list. */
export type AutomationParamId =
    | 'ink'
    | 'size'
    | 'columnPitch'
    | 'burstGain'
    | 'intensity'
    | 'rgbSplit'
    | 'shake'
    | 'float';

/** One recorded value: `v` at `t` seconds. */
export interface AutomationPoint {
    t: number;
    v: number;
}

/** Parameter id -> its points, ascending by t. A knob with no entry (or an empty list) is not automated. */
export type AutomationData = Partial<Record<AutomationParamId, AutomationPoint[]>>;
