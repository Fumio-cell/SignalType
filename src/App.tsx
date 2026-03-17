import { useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { ControlPanel } from './components/ui/ControlPanel';
import { AudioPlayerPanel } from './components/ui/AudioPlayerPanel';
import { GlitchTextScene } from './components/canvas/Scene';
import { PostFX } from './components/canvas/PostFX';
import { useAppStore } from './store/appStore';
import { loadCustomFont } from './lib/fontLoader';
import { importRecipe } from './lib/export/recipe';
import Header from './components/ui/Header';
import { signInWithGoogle, openLemonSqueezyCheckout } from './lib/commercial';

function App() {
    const [isDragging, setIsDragging] = useState(false);
    const [userStatus, setUserStatus] = useState<{ user: any, isPro: boolean }>({ user: null, isPro: false });
    const setAudio = useAppStore(state => state.setAudio);
    const updateRenderSettings = useAppStore(state => state.updateRenderSettings);

    const handleAuthStatus = useCallback((e: any) => {
        setUserStatus(e.detail);
    }, []);

    useEffect(() => {
        window.addEventListener('auth:status', handleAuthStatus as EventListener);
        return () => window.removeEventListener('auth:status', handleAuthStatus as EventListener);
    }, [handleAuthStatus]);

    useEffect(() => {
        const handleBuyPro = () => {
            if (!userStatus.user) {
                alert('Please login first to upgrade to PRO.');
                signInWithGoogle();
                return;
            }
            openLemonSqueezyCheckout(userStatus.user.id);
        };

        window.addEventListener('app:buyPro', handleBuyPro);
        return () => window.removeEventListener('app:buyPro', handleBuyPro);
    }, [userStatus]);

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
                const arrayBuffer = await file.arrayBuffer();
                try {
                    const customFont = await loadCustomFont(arrayBuffer, file.name);
                    updateRenderSettings({ customFontData: customFont, font: file.name });
                } catch (loadErr) {
                    console.error("loadCustomFont error:", loadErr);
                    alert("Failed to load font file. Check console for details: " + String(loadErr));
                }
            } else if (name.endsWith('.json')) {
                importRecipe(file);
            } else if (file.type.startsWith('audio/') || name.endsWith('.wav') || name.endsWith('.mp3')) {
                // Read and set audio
                const arrayBuffer = await file.arrayBuffer();
                const audioContext = new window.AudioContext();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                const url = URL.createObjectURL(file);
                setAudio(audioBuffer, url);
            } else {
                alert("Unsupported file format dropped.");
            }
        } catch (err) {
            console.error("Error handling dropped file:", err);
            alert("Failed to load the file: " + String(err));
        }
    }, [setAudio, updateRenderSettings]);

    return (
        <div
            className="w-screen h-screen flex flex-col relative overflow-hidden bg-zinc-950 text-white"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <Header />
            
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-emerald-500/10 backdrop-blur-sm border-2 border-emerald-500/50 border-dashed m-4 rounded-xl flex items-center justify-center pointer-events-none transition-all">
                    <div className="bg-zinc-900/90 px-8 py-6 rounded-lg shadow-2xl flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-zinc-100">Drop files here</p>
                            <p className="text-sm text-zinc-400 mt-1">Audio (.wav, .mp3), Font (.ttf, .otf), or Recipe (.json)</p>
                        </div>
                    </div>
                </div>
            )}
            {/* Main Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Viewport Area */}
                <div className="flex-1 relative flex flex-col border-r border-zinc-800">
                    <div className="absolute top-4 left-4 z-10 text-xs text-zinc-500 font-mono select-none px-2 py-1 bg-zinc-900/50 rounded backdrop-blur border border-zinc-800/50">
                        SignalType v2.1
                    </div>

                    <div className="flex-1 bg-zinc-950 relative">
                        <Canvas
                            shadows
                            camera={{ position: [0, 0, 5], fov: 45 }}
                            gl={{ preserveDrawingBuffer: true, antialias: false, alpha: true }}
                        >
                            <GlitchTextScene />
                            <PostFX />
                        </Canvas>
                    </div>
                </div>

                {/* Control Panel Area right side */}
                <ControlPanel />
            </div>

            {/* Footer / Timeline container */}
            <AudioPlayerPanel />
        </div>
    );
}

export default App;
