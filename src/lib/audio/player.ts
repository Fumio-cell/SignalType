import { useAppStore } from '@/store/appStore';

let audioContext: AudioContext | null = null;
let sourceNode: AudioBufferSourceNode | null = null;
let currentBuffer: AudioBuffer | null = null;
let startTime = 0;
// let pauseTime = 0;

export function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
}

export async function loadAudio(file: File): Promise<void> {
    const ctx = getAudioContext();
    const arrayBuffer = await file.arrayBuffer();

    // Create object URL for UI playback preview
    const url = URL.createObjectURL(file);

    try {
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
        currentBuffer = decodedBuffer;

        // Update store
        useAppStore.getState().setAudio(decodedBuffer, url);
        useAppStore.getState().setPlaying(false);
        useAppStore.getState().setCurrentTime(0);

        // Reset playback state
        stopPlayback();
    } catch (err) {
        console.error("Audio decode error:", err);
        throw err;
    }
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
        } catch (e) {
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
