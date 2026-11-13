import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Glitch, Noise, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction, GlitchMode } from 'postprocessing';
import * as THREE from 'three';
import { useAppStore } from '@/store/appStore';
import { useAudioFeatures } from '@/lib/audio/useAudioFeatures';
import { mulberry32 } from '@/lib/export/frameClock';
import { registerComposer, type ResizableComposer } from '@/lib/export/stage';

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

    // Ref for the glitch effect to manually trigger/control
    const glitchRef = useRef<any>(null);

    const chromaticOffset = useMemo(
        () => settings.rgbSplitEnabled ? new THREE.Vector2(
            settings.rgbSplit + (features.blendedTurbulence * 0.05),
            settings.rgbSplit + (features.blendedTurbulence * 0.05)
        ) : new THREE.Vector2(0, 0),
        [settings.rgbSplit, settings.rgbSplitEnabled, features.blendedTurbulence]
    );

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

    // Frame stutter effect based on onset probability
    useFrame(() => {
        const r = Math.random();
        // If we have a strong onset and high turbulence, maybe we skip rendering to stutter
        const stutterThreshold = features.onset * features.blendedTurbulence * settings.stutterProb;

        // Simplistic stutter: just don't clear/render this frame sometimes
        // (A real stutter effect might need a custom WebGLRenderTarget holding previous frames)
        if (r < stutterThreshold) {
            // Skip render (cheap stutter)
            // Note: this only works if autoClear is false, or we use a custom pass
            // For standard R3F, we rely on the Glitch pass continuous mode for now
        }
    });

    return (
        <EffectComposer ref={composerRef as any} autoClear={false}>
            <Glitch
                ref={glitchRef}
                delay={new THREE.Vector2(0.5, 1.5)} // min/max delay (Ignored in CONSTANT_MILD)
                duration={new THREE.Vector2(0.1, 0.4)} // min/max duration (Ignored in CONSTANT_MILD)
                strength={new THREE.Vector2(dynamicStrength * 0.2, dynamicStrength)} // min/max strength
                mode={GlitchMode.CONSTANT_MILD}
                active={dynamicStrength > 0.05}
                ratio={1 - (features.blendedOrder * 0.8)} // More order = less glitch ratio
                columns={glitchColumns}
                perturbationMap={perturbationMap}
            />
            <ChromaticAberration
                blendFunction={BlendFunction.NORMAL}
                offset={chromaticOffset}
            />
            <Noise
                premultiply
                blendFunction={BlendFunction.ADD}
                opacity={settings.grain + (features.flatness * 0.5)}
            />
        </EffectComposer>
    );
}
