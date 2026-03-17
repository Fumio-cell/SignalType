import { useState, useEffect } from 'react';
import { Download, Loader2, Zap } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { exportVideo } from '@/lib/export/exportVideo';

export function ExportPanel() {
    const { duration } = useAppStore();
    const [resolution, setResolution] = useState<'1080p' | '4K'>('1080p');
    const [format, setFormat] = useState<'mp4' | 'zip'>('mp4');
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [isPro, setIsPro] = useState(false);

    useEffect(() => {
        const handleAuth = (e: any) => setIsPro(e.detail.isPro);
        window.addEventListener('auth:status', handleAuth as EventListener);
        return () => window.removeEventListener('auth:status', handleAuth as EventListener);
    }, []);

    const handleGatedAction = (action: () => Promise<void>) => {
        if (!isPro) {
            if (confirm('Exporting in 4K resolution is a PRO feature. Would you like to upgrade?')) {
                window.dispatchEvent(new CustomEvent('app:buyPro'));
            }
            return;
        }
        action();
    };

    const handleExport = async () => {
        if (duration <= 0) {
            alert("Please load an audio file first");
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
            } catch (err: any) {
                console.error(err);
                alert(`Export failed: ${err.message}`);
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

    return (
        <div className="flex items-center gap-3">
            <div className="relative">
                <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as any)}
                    className={`bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-zinc-600 disabled:opacity-50 ${resolution === '4K' && !isPro ? 'text-amber-500 font-bold' : ''}`}
                    disabled={isExporting}
                >
                    <option value="1080p">1080p (FHD)</option>
                    <option value="4K">4K (Max 15s) {!isPro ? '🔒' : ''}</option>
                </select>
            </div>

            <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-zinc-600 disabled:opacity-50"
                disabled={isExporting}
            >
                <option value="mp4">.MP4</option>
                <option value="zip">.ZIP (PNG Seq - 透過対応)</option>
            </select>

            {isExporting ? (
                <div className="flex items-center gap-3 bg-zinc-900 px-4 py-1.5 rounded border border-zinc-800 w-48 max-w-full">
                    <Loader2 className="w-4 h-4 text-emerald-500 animate-spin shrink-0" />
                    <div className="flex-1 flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                            <span className="truncate w-24">{statusText}</span>
                            <span>{Math.round(progress * 100)}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                            <div
                                className="bg-emerald-500 h-full transition-all duration-200"
                                style={{ width: `${progress * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <button
                    onClick={handleExport}
                    className={`px-4 py-1.5 rounded flex items-center gap-2 text-sm font-medium transition-colors ${resolution === '4K' && !isPro ? 'bg-amber-600 hover:bg-amber-500' : 'bg-zinc-800 hover:bg-zinc-700'}`}
                >
                    {resolution === '4K' && !isPro ? <Zap className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                    {resolution === '4K' && !isPro ? 'Get PRO to Export 4K' : 'Export'}
                </button>
            )}
        </div>
    );
}
