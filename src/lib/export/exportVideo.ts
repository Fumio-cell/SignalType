import { ArrayBufferTarget as MP4ArrayBufferTarget, Muxer as MP4Muxer } from 'mp4-muxer';
import JSZip from 'jszip';
import { DEMO_MODE, DEMO_MAX_SECONDS } from '@/config';
import type { ExportStage } from './stage';

export interface ExportOptions {
    width: number;
    height: number;
    fps: number;
    format: 'mp4' | 'zip';
    duration: number; // in seconds
    onProgress?: (progress: number, status: string) => void;
    stage: ExportStage;
}

/** Thrown when this browser cannot encode the requested size. The message is shown to the user as is. */
export class ExportUnsupportedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExportUnsupportedError';
    }
}

// H.264 High profile levels (codec string suffix is the level times 10, in hex) and the limits
// that decide whether a frame size and rate fit: macroblocks per frame (16x16) and per second.
const AVC_HIGH_LEVELS = [
    { level: '4.0', codec: 'avc1.640028', maxFrameMbs: 8192, maxMbsPerSec: 245760 },
    { level: '4.2', codec: 'avc1.64002a', maxFrameMbs: 8704, maxMbsPerSec: 522240 },
    { level: '5.1', codec: 'avc1.640033', maxFrameMbs: 36864, maxMbsPerSec: 983040 },
    { level: '5.2', codec: 'avc1.640034', maxFrameMbs: 36864, maxMbsPerSec: 2073600 },
];

/** Levels that can carry width x height at fps, lowest first. */
function levelsFor(width: number, height: number, fps: number) {
    const frameMbs = Math.ceil(width / 16) * Math.ceil(height / 16);
    return AVC_HIGH_LEVELS.filter((l) => frameMbs <= l.maxFrameMbs && frameMbs * fps <= l.maxMbsPerSec);
}

/** 8 Mbit/s at 1080p, scaled with the pixel count so 4K is not starved. */
function bitrateFor(width: number, height: number): number {
    return Math.round((8_000_000 * (width * height)) / (1920 * 1080));
}

async function pickEncoderConfig(width: number, height: number, fps: number): Promise<VideoEncoderConfig> {
    if (typeof VideoEncoder === 'undefined') {
        throw new ExportUnsupportedError(
            'This browser has no video encoder (WebCodecs). Use a recent Chrome, Edge or Safari, or export a PNG sequence.',
        );
    }
    const candidates = levelsFor(width, height, fps);
    for (const c of candidates) {
        const config: VideoEncoderConfig = {
            codec: c.codec,
            width,
            height,
            framerate: fps,
            bitrate: bitrateFor(width, height),
            bitrateMode: 'variable' as BitrateMode,
        };
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) return config;
    }
    const tried = candidates.map((c) => c.level).join(', ');
    const fallback = height > 1080 ? ' Choose 1080p, or export a PNG sequence.' : ' Export a PNG sequence instead.';
    throw new ExportUnsupportedError(
        `This browser cannot encode H.264 at ${width}x${height} (levels tried: ${tried || 'none fit'}).${fallback}`,
    );
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function exportFileName(width: number, height: number, fps: number, ext: 'mp4' | 'zip'): string {
    return `signaltype_${width}x${height}_${fps}fps.${ext}`;
}

export async function exportVideo(options: ExportOptions): Promise<void> {
    const { width, height, fps, format, onProgress, stage } = options;
    // The one export limit: the demo build stops at DEMO_MAX_SECONDS.
    const duration = DEMO_MODE ? Math.min(options.duration, DEMO_MAX_SECONDS) : options.duration;
    const totalFrames = Math.floor(duration * fps);

    onProgress?.(0, 'Initializing...');

    const isPngSequence = format === 'zip';

    let muxer: MP4Muxer<MP4ArrayBufferTarget> | null = null;
    let videoEncoder: VideoEncoder | null = null;
    let encoderError: Error | null = null;

    // Check the encoder before touching the stage, so an unsupported size fails fast.
    let encoderConfig: VideoEncoderConfig | null = null;
    if (!isPngSequence) encoderConfig = await pickEncoderConfig(width, height, fps);

    let zip: JSZip | null = null;

    await stage.begin(width, height);
    try {
        if (encoderConfig) {
            muxer = new MP4Muxer({
                target: new MP4ArrayBufferTarget(),
                video: { codec: 'avc', width, height },
                fastStart: 'in-memory',
            });
            videoEncoder = new VideoEncoder({
                output: (chunk, meta) => muxer!.addVideoChunk(chunk, meta),
                error: (e) => {
                    console.error('VideoEncoder error: ', e);
                    encoderError = e;
                },
            });
            videoEncoder.configure(encoderConfig);
        } else {
            zip = new JSZip();
        }

        // The first render after a resize is not repeatable (fresh buffers); draw frame 0 once and
        // discard it. Drawing the same frame again gives the same pixels, which is what we capture.
        await stage.renderFrame(0, fps);

        for (let f = 0; f < totalFrames; f++) {
            if (encoderError) throw encoderError;

            const canvas = await stage.renderFrame(f, fps);
            if (canvas.width !== width || canvas.height !== height) {
                throw new Error(`Stage rendered ${canvas.width}x${canvas.height}, expected ${width}x${height}`);
            }

            if (zip) {
                const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
                if (!blob) throw new Error('Failed to capture PNG frame');
                zip.file(`frame_${String(f + 1).padStart(4, '0')}.png`, blob);
                onProgress?.((f / totalFrames) * 0.5, 'Rendering PNG frames...');
            } else if (videoEncoder) {
                const frame = new VideoFrame(canvas, {
                    timestamp: Math.round((f / fps) * 1_000_000),
                    duration: Math.round((1 / fps) * 1_000_000),
                });
                videoEncoder.encode(frame, { keyFrame: f % fps === 0 });
                frame.close();
                // Do not let a slow encoder (4K) queue up unbounded frames.
                while (videoEncoder.encodeQueueSize > 6) await sleep(4);
                onProgress?.((f / totalFrames) * 0.8, 'Encoding MP4 frames...');
                if (f % 4 === 0) await sleep(0);
            }
        }
    } finally {
        await stage.end();
    }

    if (zip) {
        onProgress?.(0.5, 'Zipping PNG sequence...');
        const zipContent = await zip.generateAsync({ type: 'blob' }, (metadata) => {
            onProgress?.(0.5 + (metadata.percent / 100) * 0.5, `Zipping frames... ${Math.round(metadata.percent)}%`);
        });
        onProgress?.(1.0, 'Done');
        downloadBlob(zipContent, exportFileName(width, height, fps, 'zip'));
    } else if (videoEncoder && muxer) {
        onProgress?.(0.8, 'Finalizing MP4...');
        await videoEncoder.flush();
        if (encoderError) throw encoderError;
        muxer.finalize();
        onProgress?.(1.0, 'Done');
        downloadBlob(new Blob([muxer.target.buffer], { type: 'video/mp4' }), exportFileName(width, height, fps, 'mp4'));
    }
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
