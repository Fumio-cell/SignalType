import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { exportVideo, ExportUnsupportedError } from '@/lib/export/exportVideo';
import { EXPORT_SIZES, getExportStage, useExportResolution } from '@/lib/export/stage';
import { fontSettled } from '@/lib/fontLoader';
import { DEMO_MODE, DEMO_MAX_SECONDS, BUY_URL } from '@/config';
import { notify } from '@/lib/notify';

export function ExportPanel() {
    const { duration } = useAppStore();
    const resolution = useExportResolution((s) => s.resolution);
    const setResolution = useExportResolution((s) => s.set);
    const [format, setFormat] = useState<'mp4' | 'zip'>('mp4');
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [demoLimited, setDemoLimited] = useState(false);

    const handleExport = async () => {
        if (duration <= 0) {
            notify("Load an audio file first.", { id: 'no-audio' });
            return;
        }

        const runExport = async () => {
            setIsExporting(true);
            setProgress(0);
            setStatusText('Preparing...');

            try {
                // The audio features arrive from a worker. Starting before they do would make
                // the first frames differ from run to run, so wait (bounded) for them.
                setStatusText('Analyzing audio...');
                const t0 = Date.now();
                while (useAppStore.getState().onsetStrength === null && Date.now() - t0 < 20000) {
                    await new Promise(r => setTimeout(r, 50));
                }
                const stage = getExportStage();
                if (!stage) throw new Error('The stage is not ready yet.');
                // The 3D glyphs follow the text a moment after the last keystroke; the first
                // frame must not be drawn before they have arrived.
                await fontSettled();
                const { width, height } = EXPORT_SIZES[resolution];

                await exportVideo({
                    width,
                    height,
                    fps: 30,
                    format,
                    duration,
                    stage,
                    onProgress: (p, status) => {
                        setProgress(p);
                        setStatusText(status);
                    }
                });
                // Only say so when the length limit actually cut the file.
                if (DEMO_MODE && duration > DEMO_MAX_SECONDS) setDemoLimited(true);
            } catch (err: any) {
                console.error(err);
                if (err instanceof ExportUnsupportedError) {
                    notify(err.message, { id: 'export-unsupported', tone: 'error' });
                } else {
                    notify(`Export failed: ${err.message}`, { id: 'export-failed', tone: 'error' });
                }
            } finally {
                setIsExporting(false);
                setProgress(0);
                setStatusText('');
                useAppStore.getState().setCurrentTime(0);
            }
        };

        await runExport();
    };

    const hasAudio = duration > 0;

    return (
        <div className="flex items-center gap-sp3">
            <select
                aria-label="Resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as '1080p' | '4K')}
                className="field !w-auto !py-sp1"
                disabled={isExporting}
            >
                <option value="1080p">1080p (FHD)</option>
                <option value="4K">4K (UHD)</option>
            </select>

            <select
                aria-label="Format"
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="field !w-auto !py-sp1"
                disabled={isExporting}
            >
                <option value="mp4">.MP4</option>
                <option value="zip">.ZIP (PNG sequence, alpha)</option>
            </select>

            {isExporting ? (
                <div className="flex w-56 max-w-full items-center gap-sp3 border border-line-control bg-ink-panel px-sp3 py-sp1">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-paper" aria-hidden="true" />
                    <div className="flex flex-1 flex-col gap-sp1">
                        <div className="control flex justify-between text-paper-dim">
                            <span className="w-24 truncate">{statusText}</span>
                            <span>{Math.round(progress * 100)}%</span>
                        </div>
                        <div
                            role="progressbar"
                            aria-label="Export progress"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(progress * 100)}
                            className="h-[2px] w-full bg-line-control"
                        >
                            <div className="h-full bg-paper" style={{ width: `${progress * 100}%` }} />
                        </div>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={handleExport}
                    className={hasAudio ? 'btn-fill' : 'btn'}
                >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {DEMO_MODE ? 'Export (10s preview)' : 'Export'}
                </button>
            )}

            {DEMO_MODE && demoLimited && (
                <p className="m-0 text-[11px] leading-snug text-paper-dim">
                    Demo export is limited to {DEMO_MAX_SECONDS} seconds.{' '}
                    <a href={BUY_URL} target="_blank" rel="noopener noreferrer" className="text-paper underline underline-offset-2">Get the full version</a>
                </p>
            )}
        </div>
    );
}
