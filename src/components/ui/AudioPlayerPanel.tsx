import React, { useRef, useEffect } from 'react';
import { Upload, Play, Square, Music } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import { loadAudioFile, loadSample, startPlayback, stopPlayback, getCurrentTime } from '@/lib/audio/player';
import { ExportPanel } from '@/components/ui/ExportPanel';
import { notify } from '@/lib/notify';

export function AudioPlayerPanel() {
    const { isPlaying, setPlaying, audioUrl, duration, currentTime, setCurrentTime, audioBuffer } = useAppStore();
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
            await loadAudioFile(file);
        } catch (err) {
            notify(`Failed to decode audio file (${err instanceof Error ? err.message : String(err)})`, { id: 'audio-decode', tone: 'error' });
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSample = async () => {
        try {
            await loadSample();
        } catch (err) {
            notify(`Failed to load the sample track (${err instanceof Error ? err.message : String(err)})`, { id: 'sample-load', tone: 'error' });
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    };

    const hasAudio = duration > 0;

    return (
        <footer className="z-10 flex h-16 shrink-0 items-center justify-between border-t border-line bg-ink px-sp4">
            <div className="flex items-center gap-sp4">
                <input
                    type="file"
                    accept="audio/wav,audio/aiff,audio/x-aiff,audio/mpeg,.aif,.aiff,.aifc"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    aria-label="Audio file"
                    tabIndex={-1}
                />
                {/* Until audio is loaded the sample is the one filled button; after that Export is. */}
                <button
                    type="button"
                    onClick={handleSample}
                    className={hasAudio ? 'btn' : 'btn-fill'}
                    title="Load the sample track and play it"
                >
                    <Music className="h-4 w-4" aria-hidden="true" />
                    <span>Try a sample</span>
                </button>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn"
                    title="Upload audio file"
                >
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    <span>Upload Audio</span>
                </button>

                {audioUrl && (
                    <div className="flex items-center gap-sp4">
                        <button
                            type="button"
                            onClick={() => setPlaying(!isPlaying)}
                            className="btn btn-icon h-10 w-10"
                            aria-label={isPlaying ? 'Stop' : 'Play'}
                        >
                            {isPlaying ? <Square className="h-4 w-4" fill="currentColor" aria-hidden="true" /> : <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />}
                        </button>
                        <div className="ml-sp2 flex w-64 flex-col gap-sp1 md:w-96">
                            <div className="control flex justify-between px-sp1">
                                <span className="text-paper">{formatTime(currentTime)}</span>
                                <span className="text-paper-label">{formatTime(duration)}</span>
                            </div>
                            <input
                                type="range"
                                className="playhead"
                                aria-label="Playback position"
                                aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
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
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-sp4">
                <div className="control mr-sp4 flex items-center gap-sp2 text-paper-label">
                    <span>Worker: {audioBuffer ? 'Ready' : 'Idle'}</span>
                    <div className={cn('h-2 w-2', audioBuffer ? 'bg-paper' : 'bg-line-control')} aria-hidden="true"></div>
                </div>

                <ExportPanel />
            </div>
        </footer>
    );
}
