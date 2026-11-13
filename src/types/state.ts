export interface RenderSettings {
    text: string;
    textMode: '3D' | '2D';
    font: string; // URL or name
    customFontData: any | null; // Typeface JSON holding only the glyphs of the current text (src/lib/fontLoader.ts)
    customFontUrl: string | null; // Font file URL for 2D text
    json3D: boolean; // 3D text uses the ready-made typeface JSON in `font` (Inter Bold) instead of customFontData
    fontSize: number;
    bevelEnabled: boolean;
    materialMode: 'standard' | 'metallic';
    sequenceMode: boolean; // Enable audio-driven line sequence
    sequenceThreshold: number; // Onset sensitivity
    sequenceDuration: number; // How long text stays visible
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
    stutterProb: number; // probability of frame hold on onset
    stutterFrames: number; // max frames to hold
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
