import { useAppStore } from '@/store/appStore';
import { notify } from '@/lib/notify';
import { selectPresetFont } from '@/lib/fontLoader';
import { PRESET_FONTS, type PresetFont } from '@/lib/fonts/presets';

export interface AppRecipe {
    version: string;
    settings: {
        text: string;
        /** A bundled font by its menu label, or the file name of a font the user imported. */
        font: string;
        vertical?: boolean;
        fontSize: number;
        bevelEnabled: boolean;
        materialMode: 'standard' | 'metallic';
        glitch: {
            intensityBase: number;
            stutterProb: number;
            burstGain: number;
            slices: number;
            rgbSplit: number;
            grain: number;
        };
    };
    audioModulation: {
        orderUser: number;
        turbulenceUser: number;
    };
}

/** File name of an asset URL without its build hash: /assets/Inter_Bold-Dk3f9aXc.json -> Inter_Bold.json */
function stem(url: string): string {
    const name = url.split('?')[0].split('/').pop() ?? url;
    return name.replace(/-[A-Za-z0-9_-]{8}(?=\.[^.]+$)/, '');
}

/** The bundled font a recipe names: by label, or by asset URL (older recipes) with or without the build hash. */
function findPreset(font: string): PresetFont | undefined {
    return (
        PRESET_FONTS.find((p) => p.label === font || p.url === font) ??
        PRESET_FONTS.find((p) => stem(p.url) === stem(font))
    );
}

export function exportRecipe() {
    const state = useAppStore.getState();
    const font = state.settings.render.font;
    // A bundled font is written by its label; an asset URL would break with the next build.
    const preset = PRESET_FONTS.find((p) => p.url === font);

    const recipe: AppRecipe = {
        version: '2.1.0',
        settings: {
            text: state.settings.render.text,
            font: preset ? preset.label : font,
            vertical: state.settings.render.vertical,
            fontSize: state.settings.render.fontSize,
            bevelEnabled: state.settings.render.bevelEnabled,
            materialMode: state.settings.render.materialMode,
            glitch: { ...state.settings.glitch }
        },
        audioModulation: {
            orderUser: state.orderUser,
            turbulenceUser: state.turbulenceUser
        }
    };

    const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glitch_recipe_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importRecipe(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const recipe = JSON.parse(content) as AppRecipe;

            const state = useAppStore.getState();

            // Update store
            state.updateRenderSettings({
                text: recipe.settings.text,
                ...(typeof recipe.settings.vertical === 'boolean' ? { vertical: recipe.settings.vertical } : {}),
                fontSize: recipe.settings.fontSize,
                bevelEnabled: recipe.settings.bevelEnabled,
                materialMode: recipe.settings.materialMode === 'standard' ? 'standard' : 'metallic'
            });

            // The font goes through the same path as the font menu, so the name and what is drawn agree.
            const preset = findPreset(recipe.settings.font);
            if (preset) {
                if (preset.url !== state.settings.render.font) void selectPresetFont(preset);
            } else if (recipe.settings.font !== state.settings.render.font) {
                // A font file the user imported is not stored in the recipe: keep the current font, say so.
                notify(`This recipe uses the font ${recipe.settings.font}. Import that file to draw with it.`, { id: 'recipe-font' });
            }

            state.updateGlitchSettings(recipe.settings.glitch);
            state.setOrder(recipe.audioModulation.orderUser);
            state.setTurbulence(recipe.audioModulation.turbulenceUser);

        } catch (err) {
            console.error("Failed to parse recipe file", err);
            notify("Invalid recipe file format.", { id: 'recipe-invalid', tone: 'error' });
        }
    };
    reader.readAsText(file);
}
