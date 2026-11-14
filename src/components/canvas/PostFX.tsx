import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { EffectComposer, Noise, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction, GlitchMode } from 'postprocessing';
import * as THREE from 'three';
import { useAppStore } from '@/store/appStore';
import { useAudioFeatures } from '@/lib/audio/useAudioFeatures';
import { mulberry32 } from '@/lib/export/frameClock';
import { registerComposer, type ResizableComposer } from '@/lib/export/stage';
import { BandedGlitchEffect, InkEffect } from '@/lib/look/effects';
import { RGB_SPLIT_MAX } from '@/lib/look/limits';
import { audioReach, loudness } from '@/lib/audio/levels';

// `columns` is a fraction of the UV range (0..1) in the postprocessing GlitchEffect;
// the library default is 0.05. Values >= 0.5 make the shader's range test true for
// every pixel and the whole frame collapses to a single remapped coordinate.
const GLITCH_COLUMNS_MIN = 0.02;
const GLITCH_COLUMNS_MAX = 0.12;


// The library fills the glitch displacement map with Math.random() every time the effect is
// built. Build it here once from a fixed seed so the look does not depend on when React
// happens to render (needed for reproducible exports).
const PERTURBATION_SIZE = 64;
function createPerturbationMap(): THREE.DataTexture {
    const rng = mulberry32(0x51674e11);
    const data = new Uint8Array(PERTURBATION_SIZE * PERTURBATION_SIZE * 4);
    for (let i = 0; i < data.length; i++) data[i] = rng() * 255 + 0.5;
    const map = new THREE.DataTexture(data, PERTURBATION_SIZE, PERTURBATION_SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
    map.needsUpdate = true;
    return map;
}

export function PostFX() {
    const perturbationMap = useMemo(createPerturbationMap, []);
    // Let the export resize the composer's buffers (see ExportBridge).
    const composerRef = useCallback((c: ResizableComposer | null) => registerComposer(c), []);
    useEffect(() => () => perturbationMap.dispose(), [perturbationMap]);
    const settings = useAppStore(state => state.settings.glitch);
    const features = useAudioFeatures();

    const inkAmount = useAppStore(state => state.settings.render.ink);

    // One glitch effect for the life of the stage; its settings follow the sliders below.
    const glitch = useMemo(() => {
        const effect = new BandedGlitchEffect({
            delay: new THREE.Vector2(0.5, 1.5),
            duration: new THREE.Vector2(0.1, 0.4),
            strength: new THREE.Vector2(0, 0),
            perturbationMap,
        });
        effect.mode = GlitchMode.DISABLED;
        return effect;
    }, [perturbationMap]);
    useEffect(() => () => glitch.dispose(), [glitch]);

    // INK bleed: the radius follows the loudness of the audio at the current time.
    const ink = useMemo(() => new InkEffect(), []);
    useEffect(() => () => ink.dispose(), [ink]);
    ink.radiusSource = () => {
        const st = useAppStore.getState();
        // Loudness moves the bleed around its middle; burst gain 0 leaves it at the middle, as with no audio.
        const level = st.audioBuffer
            ? Math.min(1, Math.max(0, 0.5 + audioReach(st.settings.glitch.burstGain) * (loudness(st.audioBuffer, st.currentTime) - 0.5)))
            : 0.5;
        const pixelsAt1080 = st.settings.render.ink * (3 + 12 * level);
        return pixelsAt1080 / 1080;
    };

    const chromaticOffset = useMemo(() => {
        if (!settings.rgbSplitEnabled) return new THREE.Vector2(0, 0);
        const o = Math.min(RGB_SPLIT_MAX, Math.max(0, settings.rgbSplit + features.blendedTurbulence * 0.05));
        return new THREE.Vector2(o, o);
    }, [settings.rgbSplit, settings.rgbSplitEnabled, features.blendedTurbulence]);

    // Calculate dynamic glitch strength based on audio features
    // T_user increases base glitch, Onset creates bursts
    const dynamicStrength = useMemo(() => {
        // Overall scaling down to make it less intrusive
        let s = settings.intensityBase * 0.3;

        // Add audio modulation (scaled down)
        s += (features.blendedTurbulence * 0.15);

        // Add burst from onset (scaled down much further)
        if (features.onset > 0) {
            s += features.onset * settings.burstGain * 0.05;
        }

        return Math.min(1.0, s);
    }, [settings.intensityBase, settings.burstGain, features.blendedTurbulence, features.onset]);

    // Dynamic slice calc
    const activeSlices = Math.max(1, Math.floor(settings.slices * (1 + features.blendedTurbulence)));
    // Map slice count (about 1..40) onto a safe UV fraction. At the default turbulence the
    // 10 base slices become 12 active slices, which gives 0.06.
    const glitchColumns = Math.min(GLITCH_COLUMNS_MAX, Math.max(GLITCH_COLUMNS_MIN, activeSlices * 0.005));
    // Base intensity 0 means no glitch at all: not even the bursts of the audio or the turbulence slider start one.
    const glitchActive = settings.intensityBase > 0 && dynamicStrength > 0.05;

    useLayoutEffect(() => {
        glitch.strength.set(dynamicStrength * 0.2, dynamicStrength);
        glitch.mode = glitchActive ? GlitchMode.CONSTANT_MILD : GlitchMode.DISABLED;
        glitch.ratio = 1 - features.blendedOrder * 0.8;
        glitch.columns = glitchColumns;
    }, [glitch, dynamicStrength, glitchActive, features.blendedOrder, glitchColumns]);

    const noiseOpacity = settings.grain > 0 ? settings.grain + audioReach(settings.burstGain) * features.flatness * 0.5 : 0;

    // The composer rebuilds its passes whenever its children are new objects, and a rebuilt Noise pass starts its clock
    // again. Built only when something that shows in the picture changes, so a feature that nothing uses (at burst gain 0
    // none of them is) cannot reach the picture through a re-render.
    const effects = useMemo(
        () => [
            inkAmount > 0 ? <primitive key="ink" object={ink} dispose={null} /> : <group key="ink" />,
            <primitive key="glitch" object={glitch} dispose={null} />,
            <ChromaticAberration key="chromatic" blendFunction={BlendFunction.NORMAL} offset={chromaticOffset} />,
            <Noise key="noise" premultiply blendFunction={BlendFunction.ADD} opacity={noiseOpacity} />,
        ],
        [inkAmount > 0, ink, glitch, chromaticOffset, noiseOpacity],
    );

    return (
        <EffectComposer ref={composerRef} autoClear={false}>
            {effects}
        </EffectComposer>
    );
}
