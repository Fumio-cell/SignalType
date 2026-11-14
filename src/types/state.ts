import type { TypefaceData } from '@/lib/fonts/subset';

/** A font as the stage uses it: its file URL (2D text) and the typeface JSON of the converted characters (3D text and layout). */
export interface Face {
    /** URL of the font file that troika loads, or '' for a font that exists only as typeface JSON. */
    url: string;
    data: TypefaceData;
}

/**
 * The chosen font and the font that stands in for the characters it lacks. A character belongs to
 * `primary` when its code point is in primary.data.glyphs, else to `fallback`, else it is not drawn.
 */
export interface FacePair {
    primary: Face;
    fallback: Face | null;
}

export type PresetId = 'weight' | 'ink' | 'interference';

export interface RenderSettings {
    /** The look the user chose last (src/lib/look/presets.ts). Weight is the opening state. */
    preset: PresetId;
    /** Ink bleed: 0 = off, up to 1. How far a stroke swells and how close strokes join (the INK pass). */
    ink: number;
    /** Distance between the column centres of vertical text, in em. */
    columnPitch: number;
    text: string;
    textMode: '3D' | '2D';
    font: string; // URL or name
    faces2D: FacePair | null; // How 2D text is drawn; set by src/lib/fontLoader.ts
    faces3D: FacePair | null; // How 3D text is drawn (differs from 2D only for a typeface-JSON preset)
    vertical: boolean; // Vertical writing: one character per cell from top to bottom, lines from right to left
    fontSize: number;
    bevelEnabled: boolean;
    materialMode: 'standard' | 'metallic';
    sequenceMode: boolean; // Enable audio-driven line sequence
    sequenceThreshold: number; // The lowest onset (0..1, the strongest onset of the file is 1) that changes the line
    sequenceDuration: number; // The least time a line stays on, in seconds
}

export interface GlitchSettings {
    intensityBase: number; // 0..1
    burstGain: number; // multiplier for onset
    slices: number; // base slice count
    rgbSplit: number; // base rgb shift amount
    rgbSplitEnabled: boolean; // toggle for RGB split
    verticalShake: number; // normal vertical shaking intensity
    baseFloat: number; // amplitude of the idle floating animation
    grain: number; // noise intensity
}

export interface MotionSettings {
    directionDegrees: number; // 0..360
    spread: number; // 0..1
    density: number; // mist density
    speed: number;
}

export interface AppState {
    audioBuffer: AudioBuffer | null;
    audioUrl: string | null;
    duration: number;
    isPlaying: boolean;
    currentTime: number;

    // Analysys Data (from Worker)
    onsetStrength: Float32Array | null;
    flux: Float32Array | null;
    flatness: Float32Array | null;
    texture: Float32Array | null;

    // Overridable high-level parameters (0..1)
    orderUser: number;
    turbulenceUser: number;

    seed: number;

    settings: {
        render: RenderSettings;
        glitch: GlitchSettings;
        motion: MotionSettings;
    };
}
