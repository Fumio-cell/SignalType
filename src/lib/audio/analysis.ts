import { useAppStore } from '@/store/appStore';
import AnalysisWorker from '@/workers/analysisWorker?worker';

let worker: Worker | null = null;

export function startAnalysis(audioBuffer: AudioBuffer) {
    if (worker) {
        worker.terminate();
    }

    worker = new AnalysisWorker();

    worker.onmessage = (e) => {
        if (e.data.type === 'progress') {
            // Could dispatch to a progress state if UI needs it
            console.log('Analysis Progress: ' + Math.round(e.data.progress * 100) + '%');
        } else if (e.data.type === 'result') {
            const { onsetStrength, flux, flatness, texture } = e.data;

            useAppStore.getState().setAnalysisData({
                onsetStrength,
                flux,
                flatness,
                texture
            });

            console.log("Analysis Complete");
        }
    };

    // Mix down to mono for analysis
    const left = audioBuffer.getChannelData(0);
    let monoBuffer: Float32Array;

    if (audioBuffer.numberOfChannels > 1) {
        const right = audioBuffer.getChannelData(1);
        monoBuffer = new Float32Array(left.length);
        for (let i = 0; i < left.length; i++) {
            monoBuffer[i] = (left[i] + right[i]) * 0.5;
        }
    } else {
        monoBuffer = left;
    }

    worker.postMessage({
        type: 'analyze',
        audioData: monoBuffer,
        sampleRate: audioBuffer.sampleRate,
        fftSize: 2048
    });
}
