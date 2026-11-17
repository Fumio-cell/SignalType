/**
 * The audio of the ".MP4 (with audio)" export: the loaded track, from 0 to the length of the video, encoded as AAC-LC
 * with WebCodecs. The muxing is in exportVideo.ts; the AAC priming delay is compensated in mp4Edit.ts with a number
 * measured here.
 */

const AAC = 'mp4a.40.2';
/** Sample rates AAC-LC encoders take everywhere, tried after the rate of the loaded track itself. */
const RATES = [48000, 44100];
/** What every AAC-LC encoder in use today (Apple's, Media Foundation's) delays the first real sample by, in samples. Used only if it cannot be measured. */
const DEFAULT_PRIMING = 2112;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface EncodedAudio {
    chunks: { chunk: EncodedAudioChunk; meta?: EncodedAudioChunkMetadata }[];
    sampleRate: number;
    numberOfChannels: number;
    /** Samples of the track that were encoded: the length of the audio, at `sampleRate`. */
    samples: number;
    /** Samples the encoder emits before the first real one. The file has to skip them (mp4Edit.ts). */
    priming: number;
}

const bitrateFor = (channels: number) => (channels === 1 ? 128_000 : 192_000);

async function supported(config: AudioEncoderConfig): Promise<boolean> {
    try {
        return Boolean((await AudioEncoder.isConfigSupported(config)).supported);
    } catch {
        return false;
    }
}

/** Why this browser cannot make an MP4 with audio, or null when it can. Shown next to the format choice. */
export async function audioEncoderProblem(): Promise<string | null> {
    if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') {
        return 'this browser has no audio encoder (WebCodecs)';
    }
    for (const sampleRate of RATES) {
        if (await supported({ codec: AAC, sampleRate, numberOfChannels: 2, bitrate: bitrateFor(2) })) return null;
    }
    return 'this browser cannot encode AAC audio';
}

async function pickConfig(buffer: AudioBuffer): Promise<AudioEncoderConfig> {
    const numberOfChannels = Math.min(buffer.numberOfChannels, 2);
    for (const sampleRate of new Set([buffer.sampleRate, ...RATES])) {
        const config: AudioEncoderConfig = { codec: AAC, sampleRate, numberOfChannels, bitrate: bitrateFor(numberOfChannels) };
        if (await supported(config)) return config;
    }
    throw new Error('This browser cannot encode AAC audio for this track.');
}

/** The first `seconds` of the track, one Float32Array per channel (at most two), at the rate of the encoder. */
async function planarPcm(buffer: AudioBuffer, config: AudioEncoderConfig, seconds: number): Promise<Float32Array[]> {
    const channels = config.numberOfChannels;
    const rate = config.sampleRate;
    if (rate === buffer.sampleRate) {
        const n = Math.min(buffer.length, Math.round(seconds * rate));
        return Array.from({ length: channels }, (_, c) => buffer.getChannelData(c).subarray(0, n));
    }
    const context = new OfflineAudioContext(channels, Math.round(seconds * rate), rate);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
    const rendered = await context.startRendering();
    return Array.from({ length: channels }, (_, c) => rendered.getChannelData(c));
}

/** Runs `pcm` through one AudioEncoder and returns every chunk it emits, flushed. */
async function encodeAll(config: AudioEncoderConfig, pcm: Float32Array[]): Promise<EncodedAudio['chunks']> {
    const chunks: EncodedAudio['chunks'] = [];
    const failure: { error: unknown } = { error: null };
    const encoder = new AudioEncoder({
        output: (chunk, meta) => chunks.push({ chunk, meta }),
        error: (e) => {
            failure.error = e;
        },
    });
    encoder.configure(config);
    const total = pcm[0].length;
    const block = Math.round(config.sampleRate / 2);
    for (let at = 0; at < total; at += block) {
        const frames = Math.min(block, total - at);
        const data = new Float32Array(frames * pcm.length);
        pcm.forEach((channel, i) => data.set(channel.subarray(at, at + frames), i * frames));
        const audio = new AudioData({
            format: 'f32-planar',
            sampleRate: config.sampleRate,
            numberOfFrames: frames,
            numberOfChannels: pcm.length,
            timestamp: Math.round((at / config.sampleRate) * 1_000_000),
            data,
        });
        encoder.encode(audio);
        audio.close();
        while (encoder.encodeQueueSize > 8) await sleep(2);
        if (failure.error) throw failure.error;
    }
    await encoder.flush();
    encoder.close();
    if (failure.error) throw failure.error;
    return chunks;
}

/**
 * How many samples this browser's AAC encoder puts before the first real one: a click at a known sample goes through
 * the encoder and a decoder, and is looked for in what comes out. Falls back to the usual 2112 when it cannot be done.
 */
async function measurePriming(config: AudioEncoderConfig): Promise<number> {
    if (typeof AudioDecoder === 'undefined') return DEFAULT_PRIMING;
    try {
        const rate = config.sampleRate;
        const click = Math.round(rate * 0.3);
        const signal = new Float32Array(Math.round(rate * 0.6));
        for (let i = 0; i < 64; i++) signal[click + i] = i % 2 ? -0.9 : 0.9;
        const chunks = await encodeAll(config, Array.from({ length: config.numberOfChannels }, () => signal));
        const decoderConfig = chunks.find((c) => c.meta?.decoderConfig)?.meta?.decoderConfig;
        if (!decoderConfig) return DEFAULT_PRIMING;

        const decoded: number[] = [];
        const failure: { error: unknown } = { error: null };
        const decoder = new AudioDecoder({
            output: (audio) => {
                const plane = new Float32Array(audio.numberOfFrames);
                audio.copyTo(plane, { planeIndex: 0, format: 'f32-planar' });
                for (const x of plane) decoded.push(x);
                audio.close();
            },
            error: (e) => {
                failure.error = e;
            },
        });
        decoder.configure(decoderConfig);
        for (const c of chunks) decoder.decode(c.chunk);
        await decoder.flush();
        decoder.close();
        if (failure.error) return DEFAULT_PRIMING;

        const peak = decoded.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
        const first = decoded.findIndex((x) => Math.abs(x) > peak * 0.2);
        const priming = first - click;
        return peak > 0.1 && priming >= 0 && priming <= 8192 ? priming : DEFAULT_PRIMING;
    } catch {
        return DEFAULT_PRIMING;
    }
}

/** The first `seconds` of the loaded track as AAC chunks, with the priming delay of the encoder that made them. */
export async function encodeAudio(buffer: AudioBuffer, seconds: number): Promise<EncodedAudio> {
    const config = await pickConfig(buffer);
    const pcm = await planarPcm(buffer, config, seconds);
    const priming = await measurePriming(config);
    const chunks = await encodeAll(config, pcm);
    if (chunks.length === 0) throw new Error('The audio encoder produced no data.');
    return { chunks, sampleRate: config.sampleRate, numberOfChannels: config.numberOfChannels, samples: pcm[0].length, priming };
}
