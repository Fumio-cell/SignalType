import { useAppStore } from '@/store/appStore';
import { useEffect, useState } from 'react';

// Constants matching analysisWorker
const FFT_SIZE = 2048;
const HOP_SIZE = FFT_SIZE / 4;

export function useAudioFeatures() {
    const {
        isPlaying,
        onsetStrength,
        flux,
        flatness,
        texture,
        audioBuffer,
        orderUser,
        turbulenceUser,
        settings
    } = useAppStore();

    const [currentFeatures, setCurrentFeatures] = useState({
        onset: 0,
        flux: 0,
        flatness: 0,
        texture: 0,
        estimatedOrder: 0,
        estimatedTurbulence: 0,
        blendedOrder: orderUser,
        blendedTurbulence: turbulenceUser
    });

    useEffect(() => {
        let animationFrameId: number;

        const updateFeatures = () => {
            if (!audioBuffer) return;

            const time = useAppStore.getState().currentTime;
            const sr = audioBuffer.sampleRate;

            // Calculate current frame index in the analysis arrays
            const currentSample = time * sr;
            const frameIndex = Math.floor((currentSample - FFT_SIZE) / HOP_SIZE);

            let curOnset = 0;
            let curFlux = 0;
            let curFlatness = 0;
            let curTexture = 0;

            if (onsetStrength && frameIndex >= 0 && frameIndex < onsetStrength.length) {
                // Optional: Add interpolation between frames here for smoother values
                curOnset = onsetStrength[frameIndex];
                curFlux = flux?.[frameIndex] || 0;
                curFlatness = flatness?.[frameIndex] || 0;
                curTexture = texture?.[frameIndex] || 0;
            }

            // Sequence Logic (Deterministic Time-based)
            if (settings.render.sequenceMode) {
                const lines = settings.render.text.split('\n').filter(line => line.trim().length > 0);
                const lineCnt = Math.max(1, lines.length);

                // We use sequenceDuration as the fixed interval for switching lines
                const interval = Math.max(0.1, settings.render.sequenceDuration);

                // Calculate exactly which sequence we should be on based on absolute playback time
                const sequenceAbsoluteIndex = Math.floor(time / interval);
                const expectedLineIndex = sequenceAbsoluteIndex % lineCnt;
                const expectedLastSequenceTime = sequenceAbsoluteIndex * interval;

                const state = useAppStore.getState();
                if (state.currentLineIndex !== expectedLineIndex || state.lastSequenceTime !== expectedLastSequenceTime) {
                    state.setCurrentLineIndex(expectedLineIndex);
                    state.setLastSequenceTime(expectedLastSequenceTime);
                }
            }

            // Simplified heuristic for Order/Turbulence estimation based on features
            // High flux & high flatness = high turbulence
            const estTurbulence = Math.min(1.0, (curFlux * 0.6) + (curFlatness * 0.4));
            // High harmonic content (low flatness) = high order
            const estOrder = Math.max(0.0, 1.0 - (curFlatness * 1.5));

            setCurrentFeatures({
                onset: curOnset,
                flux: curFlux,
                flatness: curFlatness,
                texture: curTexture,
                estimatedOrder: estOrder,
                estimatedTurbulence: estTurbulence,
                // Override with user values if needed, otherwise blend
                blendedOrder: orderUser, // Normally you might lerp these, but specs say UI override is priority
                blendedTurbulence: turbulenceUser
            });

            if (isPlaying) {
                animationFrameId = requestAnimationFrame(updateFeatures);
            }
        };

        if (isPlaying) {
            updateFeatures();
        } else {
            updateFeatures(); // Update once when paused
        }

        // Subscribe to time changes (e.g. from scrubbing or export seek) when paused
        const unsubscribeTime = useAppStore.subscribe(
            (state, prevState) => {
                if (state.currentTime !== prevState.currentTime && !state.isPlaying) {
                    updateFeatures();
                }
            }
        );

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            unsubscribeTime();
        };
    }, [isPlaying, audioBuffer, onsetStrength, flux, flatness, texture, orderUser, turbulenceUser]);

    return currentFeatures;
}
