import { useState, useCallback, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ControlPanel } from './components/ui/ControlPanel';
import { AudioPlayerPanel } from './components/ui/AudioPlayerPanel';
import { GlitchTextScene } from './components/canvas/Scene';
import { PostFX } from './components/canvas/PostFX';
import { ExportBridge } from './components/canvas/ExportBridge';
import { useAppStore } from './store/appStore';
import { importFontFile, initFonts } from './lib/fontLoader';
import { importRecipe } from './lib/export/recipe';
import { loadAudioFile } from './lib/audio/player';
import { Header } from './components/ui/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EXPORT_SIZES, useExportMode, useExportResolution } from './lib/export/stage';
import { NoticeHost } from './components/NoticeHost';
import { notify } from './lib/notify';

/** Two facts under the stage: where the sample track is from, and what the MP4 contains. */
function StageNotes() {
    const hasAudio = useAppStore(state => state.duration > 0);
    const isSample = useAppStore(state => state.isSample);
    return (
        <div className="note flex shrink-0 flex-wrap justify-between gap-x-sp4 gap-y-sp1 border-t border-line px-sp3 py-sp2">
            <span>{!hasAudio || isSample ? 'Sample track: "Frequency Dreams" by Bomb Sun' : ''}</span>
            <span>The MP4 has no audio track. It is an overlay; your track is already in your timeline.</span>
        </div>
    );
}

function App() {
    const [isDragging, setIsDragging] = useState(false);
    const exporting = useExportMode(state => state.active);
    const resolution = useExportResolution(state => state.resolution);
    const frame = EXPORT_SIZES[resolution];

    useEffect(() => {
        initFonts();
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        const name = file.name.toLowerCase();

        try {
            if (name.endsWith('.ttf') || name.endsWith('.otf') || name.endsWith('.ttc') || name.endsWith('.dfont')) {
                await importFontFile(file);
            } else if (name.endsWith('.json')) {
                importRecipe(file);
            } else if (file.type.startsWith('audio/') || name.endsWith('.wav') || name.endsWith('.mp3') || name.endsWith('.aif') || name.endsWith('.aiff') || name.endsWith('.aifc')) {
                // The same path as the Upload button
                await loadAudioFile(file);
            } else {
                notify("Unsupported file format. Drop audio (.wav, .mp3, .aif), a font (.ttf, .otf) or a recipe (.json).", { id: 'drop-unsupported', tone: 'error' });
            }
        } catch (err) {
            console.error("Error handling dropped file:", err);
            notify("Failed to load the file: " + String(err), { id: 'drop-failed', tone: 'error' });
        }
    }, []);

    return (
        <div
            className="relative flex h-screen w-screen flex-col overflow-hidden bg-ink text-paper"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <Header />

            {isDragging && (
                <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-ink-panel">
                    <div className="m-sp4 flex h-[calc(100%-var(--space-6))] w-[calc(100%-var(--space-6))] items-center justify-center border-2 border-dashed border-paper">
                        <div className="flex flex-col items-center gap-sp3 text-center">
                            <svg className="h-8 w-8 text-paper" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <p className="control m-0 text-paper">Drop files here</p>
                            <p className="m-0 text-sm text-paper-dim">Audio (.wav, .mp3, .aif), font (.ttf, .otf) or recipe (.json)</p>
                        </div>
                    </div>
                </div>
            )}

            <main className="flex flex-1 overflow-hidden">
                {/* Stage */}
                <div className="relative flex min-w-0 flex-1 flex-col border-r border-line">
                    <div className="control pointer-events-none absolute left-sp3 top-sp3 z-10 select-none border border-line bg-ink-panel px-sp2 py-sp1 text-paper-label">
                        SignalType
                    </div>

                    {/* The stage is letterboxed to the export frame: ink around it, ink-stage inside. */}
                    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-ink" style={{ containerType: 'size' }}>
                        <div
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-ink-stage"
                            data-testid="stage-frame"
                            style={{
                                width: `min(100cqw, calc(100cqh * ${frame.width} / ${frame.height}))`,
                                height: `min(100cqh, calc(100cqw * ${frame.height} / ${frame.width}))`,
                            }}
                        >
                            <ErrorBoundary>
                                <Canvas
                                    frameloop={exporting ? 'never' : 'always'}
                                    dpr={exporting ? 1 : [1, 2]}
                                    camera={{ position: [0, 0, 5], fov: 45 }}
                                    gl={{ preserveDrawingBuffer: true, antialias: false, alpha: true }}
                                >
                                    <Suspense fallback={null}>
                                        <GlitchTextScene />
                                        <PostFX />
                                        <ExportBridge />
                                    </Suspense>
                                </Canvas>
                            </ErrorBoundary>
                        </div>
                    </div>

                    <StageNotes />
                </div>

                <ControlPanel />
            </main>

            <AudioPlayerPanel />
            <NoticeHost />
        </div>
    );
}

export default App;
