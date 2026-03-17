import { ArrayBufferTarget as MP4ArrayBufferTarget, Muxer as MP4Muxer } from 'mp4-muxer';
import JSZip from 'jszip';

export interface ExportOptions {
    width: number;
    height: number;
    fps: number;
    format: 'mp4' | 'zip';
    duration: number; // in seconds
    onProgress?: (progress: number, status: string) => void;
    getCanvas: () => HTMLCanvasElement | null;
    seekToTime: (time: number) => Promise<void>;
}

export async function exportVideo(options: ExportOptions): Promise<void> {
    const { width, height, fps, format, duration, onProgress, getCanvas, seekToTime } = options;
    const totalFrames = Math.floor(duration * fps);

    onProgress?.(0, 'Initializing Encoder...');

    // Initialize mp4-muxer

    // Initialize Muxer based on format
    // For Mov (ProRes) with alpha, we first need a format that supports alpha from WebCodecs.
    // WebM (VP9) supports alpha. MP4 (HEVC/H.265) can support alpha but VP9 is more universally supported in WebCodecs encoding.
    // However, if the user requested MP4, we still use h264 without alpha (or with alpha if supported, but typically it isn't).
    // Let's use vp09 for MOV conversion path, and avc1 for MP4 path.

    // Ensure even dimensions for video codecs
    const encWidth = Math.floor(width / 2) * 2;
    const encHeight = Math.floor(height / 2) * 2;

    const isAlphaPath = format === 'zip';

    let muxer: any;
    let videoEncoder: VideoEncoder | null = null;
    let encoderError: Error | null = null;

    if (!isAlphaPath) {
        muxer = new MP4Muxer({
            target: new MP4ArrayBufferTarget(),
            video: {
                codec: 'avc',
                width: encWidth,
                height: encHeight
            },
            fastStart: 'in-memory'
        });

        videoEncoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            error: (e) => {
                console.error("VideoEncoder error: ", e);
                encoderError = e;
            },
        });

        const encoderConfig: VideoEncoderConfig = {
            codec: 'avc1.640028', // H.264 High Profile Level 4.0
            width: encWidth,
            height: encHeight,
            framerate: fps,
            bitrate: 8_000_000,
            bitrateMode: 'variable' as BitrateMode,
        };

        const support = await VideoEncoder.isConfigSupported(encoderConfig);
        if (!support.supported) {
            throw new Error(`MP4 VideoEncoder configuration not supported.`);
        }
        videoEncoder.configure(encoderConfig);
    }

    // Initialize JSZip early for PNG sequence path
    let zip: JSZip | null = null;
    if (isAlphaPath) {
        onProgress?.(0, 'Initializing ZIP for PNG Sequence Export...');
        zip = new JSZip();
    }

    // Frame Capture Loop
    for (let f = 0; f < totalFrames; f++) {
        if (encoderError) throw encoderError;

        const currentTime = f / fps;
        await seekToTime(currentTime);

        // Slight delay to ensure React/Three.js has rendered the requested frame
        await new Promise(r => requestAnimationFrame(r));

        const canvas = getCanvas();
        if (!canvas) throw new Error("Canvas not found for export");

        if (isAlphaPath && zip) {
            // PNG Export mode for ZIP
            const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
            if (!blob) throw new Error("Failed to capture PNG frame");
            // Pad frame number: frame_0001.png
            const frameName = `frame_${String(f + 1).padStart(4, '0')}.png`;
            zip.file(frameName, blob);
            onProgress?.((f / totalFrames) * 0.5, 'Rendering PNG Frames...');
        } else if (videoEncoder) {
            // WebCodecs MP4 Export mode
            const frame = new VideoFrame(canvas, {
                timestamp: (f / fps) * 1_000_000, // microseconds
                duration: (1 / fps) * 1_000_000,
            });

            const keyFrame = f % fps === 0;
            videoEncoder.encode(frame, { keyFrame });
            frame.close();
            onProgress?.((f / totalFrames) * 0.8, 'Encoding MP4 Frames...');
        }
    }

    if (isAlphaPath && zip) {
        onProgress?.(0.5, 'Zipping PNG Sequence...');

        const zipContent = await zip.generateAsync({ type: 'blob' }, (metadata) => {
            onProgress?.(0.5 + (metadata.percent / 100) * 0.5, `Zipping frames... ${Math.round(metadata.percent)}%`);
        });

        onProgress?.(1.0, 'Done');
        downloadBlob(zipContent, 'glitch_export_alpha_sequence.zip');
    } else if (videoEncoder) {
        onProgress?.(0.8, 'Finalizing MP4...');
        await videoEncoder.flush();
        muxer.finalize();

        const outputBuffer = muxer.target.buffer;

        onProgress?.(1.0, 'Done');
        downloadBlob(new Blob([outputBuffer], { type: 'video/mp4' }), 'glitch_export.mp4');
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
