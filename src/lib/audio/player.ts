import { useAppStore } from '@/store/appStore';
import { decodeAudioFile } from '@/lib/audio/decodeAudioFile';
import { startAnalysis } from '@/lib/audio/analysis';

let audioContext: AudioContext | null = null;
let sourceNode: AudioBufferSourceNode | null = null;
let currentBuffer: AudioBuffer | null = null;
let startTime = 0;
// let pauseTime = 0;

export function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContext;
}

export async function loadAudio(file: File): Promise<void> {
    const ctx = getAudioContext();
    const arrayBuffer = await file.arrayBuffer();

    // Create object URL for UI playback preview
    const url = URL.createObjectURL(file);

    try {
        const decodedBuffer = await decodeAudioFile(ctx, arrayBuffer);
        currentBuffer = decodedBuffer;

        // Update store
        useAppStore.getState().setAudio(decodedBuffer, url);
        useAppStore.getState().setIsSample(false);
        useAppStore.getState().setPlaying(false);
        useAppStore.getState().setCurrentTime(0);

        // Reset playback state
        stopPlayback();
    } catch (err) {
        console.error("Audio decode error:", err);
        throw err;
    }
}

/**
 * The one way an audio file gets into the app: the Upload button, a dropped file and the sample all end here.
 * Decodes it, makes it the current audio (which drops the analysis of the previous one) and starts the analysis.
 */
export async function loadAudioFile(file: File): Promise<void> {
    await loadAudio(file);
    const buffer = useAppStore.getState().audioBuffer;
    if (buffer) startAnalysis(buffer);
}

/** Where the bundled sample track is served from. */
export const SAMPLE_URL = '/sample/sample-track.m4a';

/** Load the bundled sample track and start playing it. */
export async function loadSample(): Promise<void> {
    const res = await fetch(SAMPLE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    await loadAudioFile(new File([blob], 'sample-track.m4a', { type: blob.type || 'audio/mp4' }));
    useAppStore.getState().setIsSample(true);
    useAppStore.getState().setPlaying(true);
}

export function startPlayback(offset: number = 0) {
    if (!currentBuffer) return;

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    stopPlayback(); // Ensure any existing source is stopped

    sourceNode = ctx.createBufferSource();
    sourceNode.buffer = currentBuffer;
    sourceNode.connect(ctx.destination);

    sourceNode.start(0, offset);
    startTime = ctx.currentTime - offset;
}

export function stopPlayback() {
    if (sourceNode) {
        try {
            sourceNode.stop();
        } catch {
            // Ignore if already stopped
        }
        sourceNode.disconnect();
        sourceNode = null;
    }
}

export function getCurrentTime(): number {
    if (useAppStore.getState().isPlaying && sourceNode) {
        const ctx = getAudioContext();
        return ctx.currentTime - startTime;
    }
    return useAppStore.getState().currentTime;
}
