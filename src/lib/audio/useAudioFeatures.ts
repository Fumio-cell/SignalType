import { useAppStore } from '@/store/appStore';
import { useEffect, useState } from 'react';
import { getSwitchTimes, sequenceAt } from '@/lib/audio/schedule';
import { audioReach } from '@/lib/audio/levels';

// Constants matching analysisWorker
const FFT_SIZE = 2048;
const HOP_SIZE = FFT_SIZE / 4;

interface Features {
    onset: number;
    flux: number;
    flatness: number;
    texture: number;
    estimatedOrder: number;
    estimatedTurbulence: number;
    blendedOrder: number;
    blendedTurbulence: number;
}

const estimateTurbulence = (flux: number, flatness: number) => Math.min(1.0, flux * 0.6 + flatness * 0.4);
// High harmonic content (low flatness) = high order
const estimateOrder = (flatness: number) => Math.max(0.0, 1.0 - flatness * 1.5);

// The average of the two estimates over the whole file. The sliders are the base values and the audio moves the picture
// around them: what counts is how far the estimate at time t is from the average of its own file.
const meansCache = new WeakMap<Float32Array, { order: number; turbulence: number }>();
function estimateMeans(flux: Float32Array, flatness: Float32Array) {
    let m = meansCache.get(flux);
    if (!m) {
        const n = Math.min(flux.length, flatness.length);
        let order = 0;
        let turbulence = 0;
        for (let i = 0; i < n; i++) {
            order += estimateOrder(flatness[i]);
            turbulence += estimateTurbulence(flux[i], flatness[i]);
        }
        m = { order: n ? order / n : 0, turbulence: n ? turbulence / n : 0 };
        meansCache.set(flux, m);
    }
    return m;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Everything the picture takes from the audio at the current time. A pure function of the store: (envelopes, settings, time). */
function readFeatures(): Features {
    const state = useAppStore.getState();
    const { audioBuffer, onsetStrength, flux, flatness, texture, orderUser, turbulenceUser, settings } = state;
    const time = state.currentTime;

    let onset = 0;
    let fx = 0;
    let fl = 0;
    let tx = 0;
    let estTurbulence = 0;
    let estOrder = 0;
    let dOrder = 0;
    let dTurbulence = 0;

    if (audioBuffer && onsetStrength) {
        const currentSample = time * audioBuffer.sampleRate;
        const frameIndex = Math.floor((currentSample - FFT_SIZE) / HOP_SIZE);
        if (frameIndex >= 0 && frameIndex < onsetStrength.length) {
            onset = onsetStrength[frameIndex];
            fx = flux?.[frameIndex] || 0;
            fl = flatness?.[frameIndex] || 0;
            tx = texture?.[frameIndex] || 0;
            estTurbulence = estimateTurbulence(fx, fl);
            estOrder = estimateOrder(fl);
            if (flux && flatness) {
                const means = estimateMeans(flux, flatness);
                dTurbulence = estTurbulence - means.turbulence;
                dOrder = estOrder - means.order;
            }
        }
    }

    // Order and turbulence: the slider is the base, the audio moves it. Burst gain scales how far; at 0 it does not move at all.
    const reach = audioReach(settings.glitch.burstGain);
    return {
        onset,
        flux: fx,
        flatness: fl,
        texture: tx,
        estimatedOrder: estOrder,
        estimatedTurbulence: estTurbulence,
        blendedOrder: clamp01(orderUser + reach * dOrder),
        blendedTurbulence: clamp01(turbulenceUser + reach * dTurbulence),
    };
}

/** Which line of the sequence is on at the current time, from the precomputed switch times. */
function updateSequence() {
    const state = useAppStore.getState();
    const { settings, audioBuffer, onsetStrength, duration } = state;
    if (!settings.render.sequenceMode) return;
    const lines = settings.render.text.split('\n').filter((line) => line.trim().length > 0);
    const dwell = Math.max(0.1, settings.render.sequenceDuration);
    const times = getSwitchTimes(onsetStrength, audioBuffer?.sampleRate ?? 0, duration, settings.render.sequenceThreshold, dwell);
    const seq = sequenceAt(times, state.currentTime, Math.max(1, lines.length), dwell);
    if (state.currentLineIndex !== seq.index || state.lastSequenceTime !== seq.last || state.nextSequenceTime !== seq.next) {
        state.setSequenceState(seq.index, seq.last, seq.next);
    }
}

const same = (a: Features, b: Features) => (Object.keys(a) as (keyof Features)[]).every((k) => a[k] === b[k]);

export function useAudioFeatures() {
    const isPlaying = useAppStore((s) => s.isPlaying);
    const [currentFeatures, setCurrentFeatures] = useState<Features>(() => readFeatures());

    useEffect(() => {
        let animationFrameId: number;

        const update = () => {
            updateSequence();
            const next = readFeatures();
            setCurrentFeatures((prev) => (same(prev, next) ? prev : next));
        };

        const tick = () => {
            update();
            if (useAppStore.getState().isPlaying) animationFrameId = requestAnimationFrame(tick);
        };
        update();
        if (isPlaying) animationFrameId = requestAnimationFrame(tick);

        // Paused (scrubbing, export seek, a slider moved, new analysis): read the audio again on every change of the store.
        const unsubscribe = useAppStore.subscribe(() => {
            if (!useAppStore.getState().isPlaying) update();
        });

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            unsubscribe();
        };
    }, [isPlaying]);

    return currentFeatures;
}
