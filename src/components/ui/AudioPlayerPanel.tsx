import React, { useRef, useEffect } from 'react';
import { Upload, Play, Square } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import { loadAudio, startPlayback, stopPlayback, getCurrentTime } from '@/lib/audio/player';
import { ExportPanel } from '@/components/ui/ExportPanel';

export function AudioPlayerPanel() {
    const { isPlaying, setPlaying, audioUrl, duration, currentTime, setCurrentTime } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const timeReqRef = useRef<number>(0);
    const isScrubbingRef = useRef<boolean>(false);

    // Track playback time
    useEffect(() => {
        if (isPlaying) {
            startPlayback(useAppStore.getState().currentTime);

            const updateTime = () => {
                if (!isScrubbingRef.current) {
                    const t = getCurrentTime();
                    setCurrentTime(t);
                    if (t >= duration && duration > 0) {
                        setPlaying(false);
                        setCurrentTime(0);
                        return;
                    }
                }
                timeReqRef.current = requestAnimationFrame(updateTime);
            };
            timeReqRef.current = requestAnimationFrame(updateTime);
        } else {
            stopPlayback();
            if (timeReqRef.current) cancelAnimationFrame(timeReqRef.current);
        }

        return () => {
            if (timeReqRef.current) cancelAnimationFrame(timeReqRef.current);
        };
    }, [isPlaying, duration, setCurrentTime, setPlaying]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            await loadAudio(file);
            if (useAppStore.getState().audioBuffer) {
                import('@/lib/audio/analysis').then(({ startAnalysis }) => {
                    startAnalysis(useAppStore.getState().audioBuffer!);
                });
            }
        } catch (err) {
            alert("Failed to load audio file");
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    };

    return (
        <div className="h-16 bg-zinc-950 border-t border-zinc-800 flex items-center px-4 justify-between z-10 shrink-0">
            <div className="flex items-center gap-4">
                <input
                    type="file"
                    accept="audio/wav,audio/aiff,audio/mpeg"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded flex items-center gap-2 text-sm font-medium transition-colors"
                    title="Upload WAV file"
                >
                    <Upload className="w-4 h-4" />
                    <span>Upload Audio</span>
                </button>

                {audioUrl && (
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setPlaying(!isPlaying)}
                            className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm",
                                isPlaying ? "bg-rose-500 text-white hover:bg-rose-600" : "bg-emerald-500 text-white hover:bg-emerald-600"
                            )}
                        >
                            {isPlaying ? <Square className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-1" fill="currentColor" />}
                        </button>
                        <div className="flex flex-col w-64 md:w-96 ml-2 gap-1.5">
                            <div className="flex justify-between items-center text-[10px] text-emerald-400 font-mono px-1">
                                <span>{formatTime(currentTime)}</span>
                                <span className="text-zinc-500">{formatTime(duration)}</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={duration || 100}
                                step={0.01}
                                value={currentTime}
                                onPointerDown={() => {
                                    isScrubbingRef.current = true;
                                }}
                                onChange={(e) => {
                                    const t = parseFloat(e.target.value);
                                    setCurrentTime(t);
                                }}
                                onPointerUp={() => {
                                    isScrubbingRef.current = false;
                                    if (isPlaying) {
                                        startPlayback(useAppStore.getState().currentTime);
                                    }
                                }}
                                className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <div className="text-xs text-zinc-500 font-mono flex items-center gap-2 mr-4">
                    <span>Worker: {useAppStore.getState().audioBuffer ? 'Ready' : 'Idle'}</span>
                    <div className={cn("w-2 h-2 rounded-full", useAppStore.getState().audioBuffer ? "bg-emerald-500" : "bg-zinc-700")}></div>
                </div>

                <ExportPanel />
            </div>
        </div>
    );
}
