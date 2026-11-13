import { create } from 'zustand';
import { AppState, GlitchSettings, MotionSettings, RenderSettings } from '../types/state';
import { DEFAULT_FONT } from '../lib/fonts/presets';
import { DEFAULT_COLUMN_PITCH } from '../lib/vertical/layout';

interface AppStore extends AppState {
    currentLineIndex: number;
    lastSequenceTime: number;
    setCurrentLineIndex: (index: number) => void;
    setLastSequenceTime: (time: number) => void;
    setAudio: (buffer: AudioBuffer, url: string) => void;
    setPlaying: (playing: boolean) => void;
    setCurrentTime: (time: number) => void;
    setAnalysisData: (data: Partial<AppState>) => void;
    updateRenderSettings: (updates: Partial<RenderSettings>) => void;
    updateGlitchSettings: (updates: Partial<GlitchSettings>) => void;
    updateMotionSettings: (updates: Partial<MotionSettings>) => void;
    setOrder: (val: number) => void;
    setTurbulence: (val: number) => void;
    setSeed: (seed: number) => void;
}

// The opening state is the WEIGHT look: no glitch, no colour split, no grain; extrusion, bevel and light make the picture.
const initialRender: RenderSettings = {
    preset: 'weight',
    ink: 0,
    columnPitch: DEFAULT_COLUMN_PITCH,
    text: 'GLITCH\nTEXT',
    textMode: '3D',
    // Zen Kaku Gothic New: Latin and Japanese. initFonts() converts the glyphs of the text.
    font: DEFAULT_FONT.url,
    faces2D: null,
    faces3D: null,
    vertical: false,
    fontSize: 1.0,
    bevelEnabled: true,
    materialMode: 'standard',
    sequenceMode: true,
    sequenceThreshold: 0.6,
    sequenceDuration: 0.8
};

const initialGlitch: GlitchSettings = {
    intensityBase: 0,
    burstGain: 1.5, // in WEIGHT: how far a beat pushes the depth and the light
    slices: 10,
    rgbSplit: 0,
    rgbSplitEnabled: false,
    verticalShake: 0,
    baseFloat: 0.1,
    grain: 0,
    stutterProb: 0.3,
    stutterFrames: 5,
};

const initialMotion: MotionSettings = {
    directionDegrees: 90,
    spread: 0.5,
    density: 0.5,
    speed: 1.0,
};

export const useAppStore = create<AppStore>((set) => ({
    audioBuffer: null,
    audioUrl: null,
    duration: 0,
    isPlaying: false,
    currentTime: 0,

    onsetStrength: null,
    flux: null,
    flatness: null,
    texture: null,

    orderUser: 0.8,
    turbulenceUser: 0,
    seed: 12345,

    currentLineIndex: 0,
    lastSequenceTime: 0, // Set to 0 so it's visible initially before the first beat

    settings: {
        render: initialRender,
        glitch: initialGlitch,
        motion: initialMotion,
    },

    setAudio: (buffer, url) => set({ audioBuffer: buffer, audioUrl: url, duration: buffer.duration }),
    setPlaying: (playing) => set({ isPlaying: playing }),
    setCurrentTime: (time) => set({ currentTime: time }),
    setCurrentLineIndex: (index) => set({ currentLineIndex: index }),
    setLastSequenceTime: (time) => set({ lastSequenceTime: time }),
    setAnalysisData: (data) => set({ ...data }),

    updateRenderSettings: (updates) => set((state) => ({
        settings: { ...state.settings, render: { ...state.settings.render, ...updates } }
    })),
    updateGlitchSettings: (updates) => set((state) => ({
        settings: { ...state.settings, glitch: { ...state.settings.glitch, ...updates } }
    })),
    updateMotionSettings: (updates) => set((state) => ({
        settings: { ...state.settings, motion: { ...state.settings.motion, ...updates } }
    })),

    setOrder: (val) => set({ orderUser: val }),
    setTurbulence: (val) => set({ turbulenceUser: val }),
    setSeed: (seed) => set({ seed }),
}));
