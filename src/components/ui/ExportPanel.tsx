import { useState } from 'react';
import { Download, Loader2, Zap } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { exportVideo } from '@/lib/export/exportVideo';
import { DEMO_MODE, DEMO_MAX_SECONDS, IS_PRO, BUY_URL } from '@/config';
import { notify } from '@/lib/notify';

export function ExportPanel() {
    const { duration } = useAppStore();
    const [resolution, setResolution] = useState<'1080p' | '4K'>('1080p');
    const [format, setFormat] = useState<'mp4' | 'zip'>('mp4');
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [demoLimited, setDemoLimited] = useState(false);

    const handleGatedAction = (action: () => Promise<void>) => {
        if (!IS_PRO) {
            notify('4K export is part of the full version.', {
                id: 'pro-gate',
                action: { label: 'Get the full version', href: BUY_URL },
            });
            return;
        }
        action();
    };

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
                const getCanvas = () => document.querySelector('canvas');
                const width = resolution === '4K' ? 3840 : 1920;
                const height = resolution === '4K' ? 2160 : 1080;

                await exportVideo({
                    width,
                    height,
                    fps: 30,
                    format,
                    duration: Math.min(duration, resolution === '4K' ? 15 : duration),
                    getCanvas,
                    seekToTime: async (time) => {
                        useAppStore.getState().setCurrentTime(time);
                        await new Promise(r => setTimeout(r, 16));
                    },
                    onProgress: (p, status) => {
                        setProgress(p);
                        setStatusText(status);
                    }
                });
                if (DEMO_MODE) setDemoLimited(true);
            } catch (err: any) {
                console.error(err);
                notify(`Export failed: ${err.message}`, { id: 'export-failed', tone: 'error' });
            } finally {
                setIsExporting(false);
                setProgress(0);
                setStatusText('');
                useAppStore.getState().setCurrentTime(0);
            }
        };

        if (resolution === '4K') {
            handleGatedAction(runExport);
        } else {
            await runExport();
        }
    };

    const hasAudio = duration > 0;
    const gated4K = resolution === '4K' && !IS_PRO;

    return (
        <div className="flex items-center gap-sp3">
            <select
                aria-label="Resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as any)}
                className="field !w-auto !py-sp1"
                disabled={isExporting}
            >
                <option value="1080p">1080p (FHD)</option>
                <option value="4K">{`4K (max 15s)${!IS_PRO ? ' - PRO' : ''}`}</option>
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
                    {gated4K ? <Zap className="h-4 w-4" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                    {gated4K ? 'Get PRO to Export 4K' : DEMO_MODE ? 'Export (10s preview)' : 'Export'}
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
