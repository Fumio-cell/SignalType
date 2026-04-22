import React, { useRef, useState, useEffect } from 'react';
import { Settings2, Upload, Download, Type, Zap, AudioLines, FileText } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { exportRecipe, importRecipe } from '@/lib/export/recipe';
import { loadCustomFont } from '@/lib/fontLoader';

import defaultFontUrl from '@/lib/fonts/Inter_Bold.json?url';
import poppinsRegUrl from '@/lib/fonts/Poppins-Regular.ttf?url';
import poppinsBoldUrl from '@/lib/fonts/Poppins-Bold.ttf?url';
import crimsonRegUrl from '@/lib/fonts/CrimsonText-Regular.ttf?url';
import spaceMonoUrl from '@/lib/fonts/SpaceMono-Regular.ttf?url';

const PRESET_FONTS = [
    { label: 'Inter Bold (3D Only)', url: defaultFontUrl, isTTF: false },
    { label: 'Poppins Regular (2D/3D)', url: poppinsRegUrl, isTTF: true },
    { label: 'Poppins Bold (2D/3D)', url: poppinsBoldUrl, isTTF: true },
    { label: 'Crimson Text (Serif)', url: crimsonRegUrl, isTTF: true },
    { label: 'Space Mono (Tech)', url: spaceMonoUrl, isTTF: true },
];

export function ControlPanel() {
    const {
        settings,
        updateRenderSettings,
        updateGlitchSettings,
        orderUser,
        setOrder,
        turbulenceUser,
        setTurbulence
    } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fontInputRef = useRef<HTMLInputElement>(null);
    const [isPro, setIsPro] = useState(false);

    useEffect(() => {
        const handleAuth = (e: any) => setIsPro(e.detail.isPro);
        window.addEventListener('auth:status', handleAuth as EventListener);
        return () => window.removeEventListener('auth:status', handleAuth as EventListener);
    }, []);

    const handleGatedAction = (action: () => void, featureName: string) => {
        if (!isPro) {
            if (confirm(`${featureName} is a PRO feature. Would you like to upgrade?`)) {
                window.dispatchEvent(new CustomEvent('app:buyPro'));
            }
            return;
        }
        action();
    };

    const handleRecipeImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            importRecipe(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handlePresetChange = async (url: string) => {
        if (url === 'custom') return;
        
        const preset = PRESET_FONTS.find(p => p.url === url);
        if (!preset) return;

        if (preset.isTTF) {
            try {
                const response = await fetch(preset.url);
                const arrayBuffer = await response.arrayBuffer();
                const customFont = await loadCustomFont(arrayBuffer, preset.label);
                
                updateRenderSettings({ 
                    customFontData: customFont, 
                    customFontUrl: preset.url, 
                    font: preset.url 
                });
            } catch (err) {
                console.error("Failed to load preset TTF:", err);
            }
        } else {
            updateRenderSettings({ font: url, customFontData: null, customFontUrl: null });
        }
    };

    const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleGatedAction(async () => {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const customFont = await loadCustomFont(arrayBuffer, file.name);
                    const customFontUrl = URL.createObjectURL(file);
                    updateRenderSettings({ customFontData: customFont, customFontUrl, font: file.name });
                } catch (err) {
                    console.error("Failed to load font details:", err);
                    alert("Failed to load font. Error: " + String(err));
                }
            }, "Custom font upload");
        }
        if (fontInputRef.current) fontInputRef.current.value = '';
    };

    return (
        <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full overflow-y-auto hidden-scrollbar">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/95 sticky top-0 z-10 backdrop-blur">
                <div className="flex items-center gap-2 mb-4">
                    <Settings2 className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-lg font-bold">Parameters</h2>
                    <div className="ml-auto flex gap-2">
                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleRecipeImport}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
                            title="Import Recipe JSON"
                        >
                            <Upload className="w-4 h-4" />
                        </button>
                        <button
                            onClick={exportRecipe}
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
                            title="Export Recipe JSON"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-5 flex flex-col gap-8">

                {/* Text Settings */}
                <section className="space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 uppercase tracking-wider">
                        <Type className="w-4 h-4 text-zinc-500" />
                        3D Text
                    </h3>

                    <div className="space-y-3">
                        <div className="space-y-1.5 flex flex-col">
                            <label className="text-xs text-zinc-400 font-medium">Text Content</label>
                            <textarea
                                value={settings.render.text}
                                onChange={(e) => updateRenderSettings({ text: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
                                rows={2}
                                placeholder="Enter text..."
                            />
                        </div>

                        <div className="flex gap-4">
                            <div className="space-y-1.5 flex-1">
                                <label className="text-xs text-zinc-400 font-medium">Size</label>
                                <input
                                    type="range"
                                    min="0.1" max="5.0" step="0.05"
                                    value={settings.render.fontSize}
                                    onChange={(e) => updateRenderSettings({ fontSize: parseFloat(e.target.value) })}
                                    className="w-full accent-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <label className="text-xs text-zinc-400 font-medium">Text Mode</label>
                            <select
                                value={settings.render.textMode || '3D'}
                                onChange={(e) => updateRenderSettings({ textMode: e.target.value as any })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                            >
                                <option value="3D">3D Text (Glitchy, Extruded)</option>
                                <option value="2D">2D Text (Flat, Sharp)</option>
                            </select>
                        </div>

                        <div className={`space-y-1.5 flex flex-col ${settings.render.textMode === '2D' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                            <label className="text-xs text-zinc-400 font-medium">Material</label>
                            <select
                                value={settings.render.materialMode}
                                onChange={(e) => updateRenderSettings({ materialMode: e.target.value as any })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                            >
                                <option value="standard">Standard</option>
                                <option value="metallic">Metallic</option>
                                <option value="matcap">MatCap (Stylized)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5 flex flex-col pt-4 mt-4 border-t border-zinc-800/50">
                            <label className="text-xs text-zinc-400 font-medium">Preset Font / Typography</label>
                            <select
                                value={(PRESET_FONTS.some(p => p.url === settings.render.font) || !settings.render.customFontData) ? settings.render.font : 'custom'}
                                onChange={(e) => handlePresetChange(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                            >
                                {PRESET_FONTS.map(pf => (
                                    <option key={pf.label} value={pf.url}>{pf.label}</option>
                                ))}
                                {settings.render.customFontData && !PRESET_FONTS.some(p => p.url === settings.render.font) && <option value="custom">Custom Uploaded Font</option>}
                            </select>

                            <label className="text-xs text-zinc-400 font-medium flex items-center gap-1.5 mt-3">
                                Custom Font Import {!isPro && <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="file"
                                    accept=".ttf,.otf,.ttc,.dfont"
                                    className="hidden"
                                    ref={fontInputRef}
                                    onChange={handleFontUpload}
                                />
                                <button
                                    onClick={() => fontInputRef.current?.click()}
                                    className={`flex-1 py-1.5 rounded text-xs flex items-center justify-center gap-2 transition-colors ${!isPro ? 'bg-amber-900/20 text-amber-500 border border-amber-900/30 font-bold' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    {isPro ? 'Import TTF/OTF' : 'Import TTF/OTF (PRO)'}
                                </button>
                                {settings.render.customFontData && (
                                    <button
                                        onClick={() => updateRenderSettings({ customFontData: null, customFontUrl: null, font: defaultFontUrl })}
                                        className="px-2 bg-zinc-800 hover:bg-rose-900/50 text-zinc-400 hover:text-rose-400 rounded transition-colors text-xs"
                                        title="Clear Custom Font"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                            <div className="text-[10px] text-zinc-500 truncate mt-1">
                                {settings.render.customFontData 
                                    ? `Typeface Active (${PRESET_FONTS.find(p => p.url === settings.render.font)?.label || settings.render.font})` 
                                    : 'Internal JSON Font Active'}
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 mt-4 border-t border-zinc-800/50">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-zinc-400 font-medium">Auto Sequence Mode</label>
                                <button
                                    onClick={() => updateRenderSettings({ sequenceMode: !settings.render.sequenceMode })}
                                    className={`w-8 h-4 rounded-full transition-colors relative ${settings.render.sequenceMode ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                                >
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-zinc-200 transition-all ${settings.render.sequenceMode ? 'left-4.5' : 'left-0.5'}`} />
                                </button>
                            </div>

                            <div className={`space-y-1.5 transition-opacity ${settings.render.sequenceMode ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                                <div className="flex justify-between text-xs pt-2">
                                    <label className="text-zinc-500 font-medium text-[10px] uppercase">Text Duration (s)</label>
                                    <span className="text-zinc-500 font-mono text-xs">{settings.render.sequenceDuration?.toFixed(1) || '0.8'}s</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1" max="10.0" step="0.1"
                                    value={settings.render.sequenceDuration || 0.8}
                                    onChange={(e) => updateRenderSettings({ sequenceDuration: parseFloat(e.target.value) })}
                                    className="w-full accent-emerald-500"
                                />
                                <p className="text-[10px] text-zinc-600 leading-tight">
                                    Displays each line for this duration, fading out in the last 20%. Audio dynamics only affect Glitch effects.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="h-px bg-zinc-800 w-full" />

                {/* Global O/T Parameters */}
                <section className="space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 uppercase tracking-wider">
                        <AudioLines className="w-4 h-4 text-zinc-500" />
                        Core Dynamics
                    </h3>

                    <div className="space-y-4 bg-zinc-950/50 p-4 rounded-lg border border-zinc-800/50">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <label className="text-zinc-300 font-medium">Order (O)</label>
                                <span className="text-emerald-400 font-mono">{orderUser.toFixed(2)}</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.01"
                                value={orderUser} onChange={(e) => setOrder(parseFloat(e.target.value))}
                                className="w-full accent-emerald-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <label className="text-zinc-300 font-medium">Turbulence (T)</label>
                                <span className="text-rose-400 font-mono">{turbulenceUser.toFixed(2)}</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.01"
                                value={turbulenceUser} onChange={(e) => setTurbulence(parseFloat(e.target.value))}
                                className="w-full accent-rose-500"
                            />
                        </div>
                    </div>
                </section>

                <div className="h-px bg-zinc-800 w-full" />

                {/* Glitch Settings */}
                <section className="space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 uppercase tracking-wider">
                        <Zap className="w-4 h-4 text-zinc-500" />
                        Glitch FX
                    </h3>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <label className="text-zinc-400 font-medium">Base Intensity</label>
                                <span className="text-zinc-500">{settings.glitch.intensityBase.toFixed(2)}</span>
                            </div>
                            <input
                                type="range" min="0" max="0.5" step="0.01"
                                value={settings.glitch.intensityBase}
                                onChange={(e) => updateGlitchSettings({ intensityBase: parseFloat(e.target.value) })}
                                className="w-full accent-emerald-500"
                            />
                        </div>

                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-zinc-400 font-medium">Enable RGB Split</label>
                                <button
                                    onClick={() => updateGlitchSettings({ rgbSplitEnabled: !settings.glitch.rgbSplitEnabled })}
                                    className={`w-8 h-4 rounded-full transition-colors relative ${settings.glitch.rgbSplitEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                                >
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-zinc-200 transition-all ${settings.glitch.rgbSplitEnabled ? 'left-4.5' : 'left-0.5'}`} />
                                </button>
                            </div>

                            <div className={`space-y-1.5 transition-opacity ${settings.glitch.rgbSplitEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                                <div className="flex justify-between text-xs">
                                    <label className="text-zinc-400 font-medium flex items-center gap-1.5">
                                        RGB Split Spread {!isPro && <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />}
                                    </label>
                                    <span className="text-zinc-500">{settings.glitch.rgbSplit.toFixed(3)}</span>
                                </div>
                                <input
                                    type="range" min="0" max="0.1" step="0.005"
                                    value={settings.glitch.rgbSplit}
                                    onChange={(e) => {
                                        if (!isPro && e.target.value !== "0.01") { // Simple threshold check
                                            handleGatedAction(() => {}, "Advanced RGB split");
                                            return;
                                        }
                                        updateGlitchSettings({ rgbSplit: parseFloat(e.target.value) });
                                    }}
                                    className={`w-full ${!isPro ? 'accent-amber-500' : 'accent-emerald-500'}`}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-zinc-800/50 mt-2">
                            <div className="flex justify-between text-xs">
                                <label className="text-zinc-400 font-medium">Vertical Shake</label>
                                <span className="text-zinc-500">{settings.glitch.verticalShake.toFixed(2)}</span>
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={settings.glitch.verticalShake}
                                onChange={(e) => updateGlitchSettings({ verticalShake: parseFloat(e.target.value) })}
                                className="w-full accent-emerald-500"
                            />
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-zinc-800/50 mt-2">
                            <div className="flex justify-between text-xs">
                                <label className="text-zinc-400 font-medium">Ambient Float</label>
                                <span className="text-zinc-500">{settings.glitch.baseFloat?.toFixed(2) || "0.10"}</span>
                            </div>
                            <input
                                type="range" min="0" max="0.5" step="0.01"
                                value={settings.glitch.baseFloat ?? 0.1}
                                onChange={(e) => updateGlitchSettings({ baseFloat: parseFloat(e.target.value) })}
                                className="w-full accent-sky-500"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <label className="text-zinc-400 font-medium">Slices</label>
                                <span className="text-zinc-500">{settings.glitch.slices}</span>
                            </div>
                            <input
                                type="range" min="1" max="50" step="1"
                                value={settings.glitch.slices}
                                onChange={(e) => updateGlitchSettings({ slices: parseInt(e.target.value) })}
                                className="w-full accent-emerald-500"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <label className="text-zinc-400 font-medium">Audio Burst Gain</label>
                                <span className="text-zinc-500">{settings.glitch.burstGain.toFixed(2)}x</span>
                            </div>
                            <input
                                type="range" min="0" max="3" step="0.05"
                                value={settings.glitch.burstGain}
                                onChange={(e) => updateGlitchSettings({ burstGain: parseFloat(e.target.value) })}
                                className="w-full accent-yellow-500"
                            />
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
}
