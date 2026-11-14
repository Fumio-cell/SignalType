import { useAppStore } from '@/store/appStore';
import { selectPresetFont } from '@/lib/fontLoader';
import { DEFAULT_FONT, INK_FONT, type PresetFont } from '@/lib/fonts/presets';
import type { GlitchSettings, PresetId, RenderSettings } from '@/types/state';

/**
 * The three looks, the verbs of the tool. A look is a bundle of the settings that already exist; choosing
 * one sets them all, after which every knob can still be moved.
 */
export interface LookPreset {
    id: PresetId;
    label: string;
    note: string;
    render: Partial<RenderSettings>;
    glitch: GlitchSettings;
    order: number;
    turbulence: number;
    /** Typeface the look opens with; null keeps whatever font is in use. */
    font: PresetFont | null;
}

const still: GlitchSettings = {
    intensityBase: 0,
    burstGain: 1.5,
    slices: 10,
    rgbSplit: 0,
    rgbSplitEnabled: false,
    verticalShake: 0,
    baseFloat: 0.1,
    grain: 0,
};

export const LOOK_PRESETS: LookPreset[] = [
    {
        id: 'weight',
        label: 'Weight',
        note: 'Extrusion and bevel make the picture. The beat moves depth and light.',
        render: { textMode: '3D', bevelEnabled: true, materialMode: 'standard', ink: 0 },
        glitch: still,
        order: 0.8,
        turbulence: 0,
        font: null,
    },
    {
        id: 'ink',
        label: 'Ink',
        note: 'Strokes swell and join; loudness sets how far.',
        render: { textMode: '2D', ink: 0.7 },
        glitch: still,
        order: 0.8,
        turbulence: 0,
        font: INK_FONT,
    },
    {
        id: 'interference',
        label: 'Interference',
        note: 'Bands and a colour split, limited to the text.',
        render: { textMode: '3D', bevelEnabled: true, materialMode: 'standard', ink: 0 },
        glitch: {
            intensityBase: 0.2,
            burstGain: 1.5,
            slices: 10,
            rgbSplit: 0.0015,
            rgbSplitEnabled: true,
            verticalShake: 0.1,
            baseFloat: 0.1,
            grain: 0.1,
        },
        order: 0.8,
        turbulence: 0.2,
        font: null,
    },
];

export function applyPreset(id: PresetId): void {
    const next = LOOK_PRESETS.find((p) => p.id === id)!;
    const store = useAppStore.getState();
    const prev = LOOK_PRESETS.find((p) => p.id === store.settings.render.preset)!;
    const currentFont = store.settings.render.font;

    store.updateRenderSettings({ ...next.render, preset: id });
    store.updateGlitchSettings({ ...next.glitch });
    store.setOrder(next.order);
    store.setTurbulence(next.turbulence);

    // The typeface follows the look unless the user chose another one: only a font that the previous
    // look itself brought in is replaced.
    const brought = (prev.font ?? DEFAULT_FONT).url;
    if (currentFont === brought) {
        const target = next.font ?? DEFAULT_FONT;
        if (target.url !== currentFont) void selectPresetFont(target);
    }
}
