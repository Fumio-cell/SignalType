import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Glitch, Noise, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction, GlitchMode } from 'postprocessing';
import * as THREE from 'three';
import { useAppStore } from '@/store/appStore';
import { useAudioFeatures } from '@/lib/audio/useAudioFeatures';

export function PostFX() {
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
        <EffectComposer autoClear={false}>
            <Glitch
                ref={glitchRef}
                delay={new THREE.Vector2(0.5, 1.5)} // min/max delay (Ignored in CONSTANT_MILD)
                duration={new THREE.Vector2(0.1, 0.4)} // min/max duration (Ignored in CONSTANT_MILD)
                strength={new THREE.Vector2(dynamicStrength * 0.2, dynamicStrength)} // min/max strength
                mode={GlitchMode.CONSTANT_MILD}
                active={dynamicStrength > 0.05}
                ratio={1 - (features.blendedOrder * 0.8)} // More order = less glitch ratio
                columns={activeSlices * 5}
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
