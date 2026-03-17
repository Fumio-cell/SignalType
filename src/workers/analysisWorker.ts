export interface AnalysisMessage {
    type: 'analyze';
    audioData: Float32Array;
    sampleRate: number;
    fftSize?: number;
}

export interface AnalysisResult {
    type: 'result';
    onsetStrength: Float32Array;
    flux: Float32Array;
    flatness: Float32Array;
    texture: Float32Array;
}

export interface AnalysisProgress {
    type: 'progress';
    progress: number; // 0..1
}

// Simple FFT implementation (Radix-2 Cooley-Tukey)
function fft(real: Float32Array, imag: Float32Array) {
    const n = real.length;
    // Bit-reversed addressing
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
        if (i < j) {
            const tr = real[j];
            const ti = imag[j];
            real[j] = real[i];
            imag[j] = imag[i];
            real[i] = tr;
            imag[i] = ti;
        }
        let k = n >> 1;
        while (k <= j) {
            j -= k;
            k >>= 1;
        }
        j += k;
    }

    // Iterative FFT
    for (let size = 2; size <= n; size *= 2) {
        const halfSize = size / 2;
        const tablestep = n / size;
        for (let i = 0; i < n; i += size) {
            for (let j = i, k = 0; j < i + halfSize; j++, k += tablestep) {
                const theta = -2 * Math.PI * k / n;
                const cosTheta = Math.cos(theta);
                const sinTheta = Math.sin(theta);

                const tReal = real[j + halfSize] * cosTheta - imag[j + halfSize] * sinTheta;
                const tImag = real[j + halfSize] * sinTheta + imag[j + halfSize] * cosTheta;

                real[j + halfSize] = real[j] - tReal;
                imag[j + halfSize] = imag[j] - tImag;
                real[j] += tReal;
                imag[j] += tImag;
            }
        }
    }
}

self.onmessage = (e: MessageEvent<AnalysisMessage>) => {
    if (e.data.type === 'analyze') {
        const { audioData } = e.data;
        const fftSize = e.data.fftSize || 2048;
        const hopSize = fftSize / 4;

        const numFrames = Math.floor((audioData.length - fftSize) / hopSize);

        const onsetStrength = new Float32Array(numFrames);
        const flux = new Float32Array(numFrames);
        const flatness = new Float32Array(numFrames);
        const texture = new Float32Array(numFrames); // Using high-frequency energy ratio as a proxy

        const window = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1))); // Hann window
        }

        const real = new Float32Array(fftSize);
        const imag = new Float32Array(fftSize);
        let prevMag = new Float32Array(fftSize / 2);

        for (let i = 0; i < numFrames; i++) {
            const offset = i * hopSize;

            // Apply window
            for (let j = 0; j < fftSize; j++) {
                real[j] = audioData[offset + j] * window[j];
                imag[j] = 0;
            }

            fft(real, imag);

            let currentFlux = 0;
            let geoMeanLog = 0;
            let arithMean = 0;
            let highFreqEnergy = 0;
            let totalEnergy = 0;

            const numBins = fftSize / 2;
            const currentMag = new Float32Array(numBins);

            for (let k = 0; k < numBins; k++) {
                const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
                currentMag[k] = mag;

                // Flux (positive differences only)
                const diff = mag - prevMag[k];
                if (diff > 0) currentFlux += diff;

                // Flatness components
                const val = Math.max(mag, 1e-10); // avoid log(0)
                geoMeanLog += Math.log(val);
                arithMean += val;

                // Texture approximation: ratio of energy in upper half of spectrum
                if (k > numBins / 2) {
                    highFreqEnergy += mag;
                }
                totalEnergy += mag;
            }

            flux[i] = currentFlux;

            arithMean /= numBins;
            geoMeanLog /= numBins;
            const flat = Math.exp(geoMeanLog) / Math.max(arithMean, 1e-10);
            flatness[i] = flat;

            texture[i] = totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;

            // Onset (simplified: just use flux for now, can be smoothed later)
            onsetStrength[i] = currentFlux;

            prevMag = currentMag;

            if (i % 100 === 0) {
                self.postMessage({ type: 'progress', progress: i / numFrames });
            }
        }

        // Normalize arrays
        const normalize = (arr: Float32Array) => {
            let max = 0;
            for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
            if (max > 0) {
                for (let i = 0; i < arr.length; i++) arr[i] /= max;
            }
        };
        normalize(onsetStrength);
        normalize(flux);
        normalize(texture);

        (self as any).postMessage({
            type: 'result',
            onsetStrength,
            flux,
            flatness,
            texture
        }, [onsetStrength.buffer, flux.buffer, flatness.buffer, texture.buffer]);
    }
};
