import { useAppStore } from '@/store/appStore';

export interface AppRecipe {
    version: string;
    settings: {
        text: string;
        font: string;
        fontSize: number;
        bevelEnabled: boolean;
        materialMode: 'standard' | 'metallic' | 'matcap';
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

export function exportRecipe() {
    const state = useAppStore.getState();

    const recipe: AppRecipe = {
        version: '2.1.0',
        settings: {
            text: state.settings.render.text,
            font: state.settings.render.font,
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
                font: recipe.settings.font,
                fontSize: recipe.settings.fontSize,
                bevelEnabled: recipe.settings.bevelEnabled,
                materialMode: recipe.settings.materialMode
            });

            state.updateGlitchSettings(recipe.settings.glitch);
            state.setOrder(recipe.audioModulation.orderUser);
            state.setTurbulence(recipe.audioModulation.turbulenceUser);

        } catch (err) {
            console.error("Failed to parse recipe file", err);
            alert("Invalid recipe file format.");
        }
    };
    reader.readAsText(file);
}
