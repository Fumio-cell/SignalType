import React, { useRef } from 'react';
import { Settings2, Upload, Download, Type, Zap, AudioLines, FileText, X, Layers } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { exportRecipe, importRecipe } from '@/lib/export/recipe';
import { importFontFile, selectPresetFont, useFontStatus } from '@/lib/fontLoader';
import { DEFAULT_FONT, PRESET_FONTS } from '@/lib/fonts/presets';
import { applyPreset, LOOK_PRESETS } from '@/lib/look/presets';
import { RGB_SPLIT_MAX } from '@/lib/look/limits';
import { MAX_COLUMN_PITCH, MIN_COLUMN_PITCH } from '@/lib/vertical/layout';

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
    const fontBusy = useFontStatus(state => state.busy);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fontInputRef = useRef<HTMLInputElement>(null);

    const handleRecipeImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            importRecipe(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handlePresetChange = (url: string) => {
        const preset = PRESET_FONTS.find(p => p.url === url);
        if (preset) void selectPresetFont(preset);
    };

    const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) void importFontFile(file);
        if (fontInputRef.current) fontInputRef.current.value = '';
    };

    return (
        <div className="hidden-scrollbar flex h-full w-80 flex-col overflow-y-auto bg-ink">
            <div className="sticky top-0 z-10 border-b border-line bg-ink p-sp4">
                <div className="flex items-center gap-sp2">
                    <Settings2 className="h-4 w-4 text-paper-dim" aria-hidden="true" />
                    <h2 className="control m-0 text-paper">Parameters</h2>
                    <div className="ml-auto flex gap-sp2">
                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleRecipeImport}
                            aria-label="Recipe JSON file"
                            tabIndex={-1}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="btn btn-icon"
                            aria-label="Import recipe JSON"
                            title="Import recipe JSON"
                        >
                            <Upload className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={exportRecipe}
                            className="btn btn-icon"
                            aria-label="Export recipe JSON"
                            title="Export recipe JSON"
                        >
                            <Download className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-sp5 p-sp4">

                {/* Looks: the verbs. */}
                <section aria-labelledby="sec-look" className="flex flex-col gap-sp3">
                    <h3 id="sec-look" className="control m-0 flex items-center gap-sp2 text-paper-dim">
                        <Layers className="h-4 w-4" aria-hidden="true" />
                        Look
                    </h3>
                    <div role="group" aria-labelledby="sec-look" className="flex flex-col gap-sp2">
                        {LOOK_PRESETS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                className="chip"
                                aria-pressed={settings.render.preset === p.id}
                                onClick={() => applyPreset(p.id)}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <p className="note m-0">{LOOK_PRESETS.find((p) => p.id === settings.render.preset)?.note}</p>

                    <div className="flex flex-col gap-sp1">
                        <div className="flex justify-between">
                            <label htmlFor="f-ink" className="control text-paper-dim">Ink bleed</label>
                            <output htmlFor="f-ink" className="control text-paper-label">{settings.render.ink.toFixed(2)}</output>
                        </div>
                        <input
                            id="f-ink"
                            type="range" min="0" max="1" step="0.01"
                            value={settings.render.ink}
                            onChange={(e) => updateRenderSettings({ ink: parseFloat(e.target.value) })}
                        />
                    </div>
                </section>

                <div className="rule" />

                {/* Text Settings */}
                <section aria-labelledby="sec-text" className="flex flex-col gap-sp3">
                    <h3 id="sec-text" className="control m-0 flex items-center gap-sp2 text-paper-dim">
                        <Type className="h-4 w-4" aria-hidden="true" />
                        3D Text
                    </h3>

                    <div className="flex flex-col gap-sp3">
                        <div className="flex flex-col gap-sp1">
                            <label htmlFor="f-text" className="control text-paper-dim">Text content</label>
                            <textarea
                                id="f-text"
                                value={settings.render.text}
                                onChange={(e) => updateRenderSettings({ text: e.target.value })}
                                className="field resize-none"
                                rows={2}
                                placeholder="Enter text..."
                            />
                        </div>

                        <div className="flex flex-col gap-sp1">
                            <label htmlFor="f-size" className="control text-paper-dim">Size</label>
                            <input
                                id="f-size"
                                type="range"
                                min="0.1" max="5.0" step="0.05"
                                value={settings.render.fontSize}
                                onChange={(e) => updateRenderSettings({ fontSize: parseFloat(e.target.value) })}
                            />
                        </div>

                        <div className="flex flex-col gap-sp1">
                            <label htmlFor="f-mode" className="control text-paper-dim">Text mode</label>
                            <select
                                id="f-mode"
                                value={settings.render.textMode || '3D'}
                                onChange={(e) => updateRenderSettings({ textMode: e.target.value as any })}
                                className="field"
                            >
                                <option value="3D">3D Text (Glitchy, Extruded)</option>
                                <option value="2D">2D Text (Flat, Sharp)</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between">
                            <span id="l-vertical" className="control text-paper-dim">Vertical</span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={settings.render.vertical}
                                aria-labelledby="l-vertical"
                                onClick={() => updateRenderSettings({ vertical: !settings.render.vertical })}
                                className="switch"
                            />
                        </div>

                        <div className="flex flex-col gap-sp1">
                            <div className="flex justify-between">
                                <label htmlFor="f-pitch" className="control text-paper-dim">Column pitch</label>
                                <output htmlFor="f-pitch" className="control text-paper-label">{settings.render.columnPitch.toFixed(2)} em</output>
                            </div>
                            <input
                                id="f-pitch"
                                type="range" min={MIN_COLUMN_PITCH} max={MAX_COLUMN_PITCH} step="0.01"
                                value={settings.render.columnPitch}
                                disabled={!settings.render.vertical}
                                onChange={(e) => updateRenderSettings({ columnPitch: parseFloat(e.target.value) })}
                            />
                        </div>

                        <div className="flex flex-col gap-sp1">
                            <label htmlFor="f-material" className="control text-paper-dim">Material</label>
                            <select
                                id="f-material"
                                value={settings.render.materialMode}
                                onChange={(e) => updateRenderSettings({ materialMode: e.target.value as any })}
                                className="field"
                                disabled={settings.render.textMode === '2D'}
                            >
                                <option value="standard">Standard</option>
                                <option value="metallic">Metallic</option>
                            </select>
                        </div>

                        <div className="mt-sp3 flex flex-col gap-sp1 border-t border-line pt-sp3">
                            <label htmlFor="f-font" className="control text-paper-dim">Preset font</label>
                            <select
                                id="f-font"
                                value={PRESET_FONTS.some(p => p.url === settings.render.font) ? settings.render.font : 'custom'}
                                onChange={(e) => handlePresetChange(e.target.value)}
                                className="field"
                            >
                                {PRESET_FONTS.map(pf => (
                                    <option key={pf.label} value={pf.url}>{pf.label}</option>
                                ))}
                                {!PRESET_FONTS.some(p => p.url === settings.render.font) && <option value="custom">{settings.render.font}</option>}
                            </select>

                            <div className="mt-sp3 flex items-center gap-sp2">
                                <span id="l-fontimport" className="control text-paper-dim">Custom font import</span>
                            </div>
                            <div className="flex gap-sp2">
                                <input
                                    type="file"
                                    accept=".ttf,.otf,.ttc,.dfont"
                                    className="hidden"
                                    ref={fontInputRef}
                                    onChange={handleFontUpload}
                                    aria-labelledby="l-fontimport"
                                    tabIndex={-1}
                                />
                                <button
                                    type="button"
                                    onClick={() => fontInputRef.current?.click()}
                                    className="btn flex-1"
                                >
                                    <FileText className="h-4 w-4" aria-hidden="true" />
                                    Import TTF/OTF
                                </button>
                                {settings.render.font !== DEFAULT_FONT.url && (
                                    <button
                                        type="button"
                                        onClick={() => void selectPresetFont(DEFAULT_FONT)}
                                        className="btn btn-icon"
                                        aria-label="Back to the default font"
                                        title="Back to the default font"
                                    >
                                        <X className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                            <div className="note mt-sp1 truncate">
                                {fontBusy
                                    ? 'Reading font…'
                                    : `Font: ${PRESET_FONTS.find(p => p.url === settings.render.font)?.label || settings.render.font}`}
                            </div>
                        </div>

                        <div className="mt-sp3 flex flex-col gap-sp3 border-t border-line pt-sp3">
                            <div className="flex items-center justify-between">
                                <span id="l-sequence" className="control text-paper-dim">Auto sequence mode</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={settings.render.sequenceMode}
                                    aria-labelledby="l-sequence"
                                    onClick={() => updateRenderSettings({ sequenceMode: !settings.render.sequenceMode })}
                                    className="switch"
                                />
                            </div>

                            <div className="flex flex-col gap-sp1">
                                <div className="flex justify-between">
                                    <label htmlFor="f-seqdur" className="control text-paper-label">Text duration (s)</label>
                                    <output htmlFor="f-seqdur" className="control text-paper-label">{settings.render.sequenceDuration?.toFixed(1) || '0.8'}s</output>
                                </div>
                                <input
                                    id="f-seqdur"
                                    type="range"
                                    min="0.1" max="10.0" step="0.1"
                                    value={settings.render.sequenceDuration || 0.8}
                                    onChange={(e) => updateRenderSettings({ sequenceDuration: parseFloat(e.target.value) })}
                                    disabled={!settings.render.sequenceMode}
                                />
                                <p className="note m-0">
                                    Displays each line for this duration, fading out in the last 20%. Audio dynamics only affect Glitch effects.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="rule" />

                {/* Global O/T Parameters */}
                <section aria-labelledby="sec-core" className="flex flex-col gap-sp3">
                    <h3 id="sec-core" className="control m-0 flex items-center gap-sp2 text-paper-dim">
                        <AudioLines className="h-4 w-4" aria-hidden="true" />
                        Core Dynamics
                    </h3>

                    <div className="flex flex-col gap-sp3 border border-line bg-ink-panel p-sp3">
                        <div className="flex flex-col gap-sp1">
                            <div className="flex justify-between">
                                <label htmlFor="f-order" className="control text-paper-dim">Order (O)</label>
                                <output htmlFor="f-order" className="control text-paper">{orderUser.toFixed(2)}</output>
                            </div>
                            <input
                                id="f-order"
                                type="range" min="0" max="1" step="0.01"
                                value={orderUser} onChange={(e) => setOrder(parseFloat(e.target.value))}
                            />
                        </div>

                        <div className="flex flex-col gap-sp1">
                            <div className="flex justify-between">
                                <label htmlFor="f-turb" className="control text-paper-dim">Turbulence (T)</label>
                                <output htmlFor="f-turb" className="control text-paper">{turbulenceUser.toFixed(2)}</output>
                            </div>
                            <input
                                id="f-turb"
                                type="range" min="0" max="1" step="0.01"
                                value={turbulenceUser} onChange={(e) => setTurbulence(parseFloat(e.target.value))}
                            />
                        </div>
                    </div>
                </section>

                <div className="rule" />

                {/* Glitch Settings */}
                <section aria-labelledby="sec-glitch" className="flex flex-col gap-sp3">
                    <h3 id="sec-glitch" className="control m-0 flex items-center gap-sp2 text-paper-dim">
                        <Zap className="h-4 w-4" aria-hidden="true" />
                        Glitch FX
                    </h3>

                    <div className="flex flex-col gap-sp3">
                        <div className="flex flex-col gap-sp1">
                            <div className="flex justify-between">
                                <label htmlFor="f-intensity" className="control text-paper-dim">Base intensity</label>
                                <output htmlFor="f-intensity" className="control text-paper-label">{settings.glitch.intensityBase.toFixed(2)}</output>
                            </div>
                            <input
                                id="f-intensity"
                                type="range" min="0" max="0.5" step="0.01"
                                value={settings.glitch.intensityBase}
                                onChange={(e) => updateGlitchSettings({ intensityBase: parseFloat(e.target.value) })}
                            />
                        </div>

                        <div className="flex flex-col gap-sp3 pt-sp2">
                            <div className="flex items-center justify-between">
                                <span id="l-rgb" className="control text-paper-dim">Enable RGB split</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={settings.glitch.rgbSplitEnabled}
                                    aria-labelledby="l-rgb"
                                    onClick={() => updateGlitchSettings({ rgbSplitEnabled: !settings.glitch.rgbSplitEnabled })}
                                    className="switch"
                                />
                            </div>

                            <div className="flex flex-col gap-sp1">
                                <div className="flex justify-between">
                                    <label htmlFor="f-rgb" className="control flex items-center gap-sp2 text-paper-dim">
                                        RGB split spread
                                    </label>
                                    <output htmlFor="f-rgb" className="control text-paper-label">{(Math.min(settings.glitch.rgbSplit, RGB_SPLIT_MAX) * 1920).toFixed(1)} px</output>
                                </div>
                                <input
                                    id="f-rgb"
                                    type="range" min="0" max={RGB_SPLIT_MAX} step="0.0001"
                                    value={Math.min(settings.glitch.rgbSplit, RGB_SPLIT_MAX)}
                                    disabled={!settings.glitch.rgbSplitEnabled}
                                    onChange={(e) => updateGlitchSettings({ rgbSplit: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="mt-sp2 flex flex-col gap-sp1 border-t border-line pt-sp3">
                            <div className="flex justify-between">
                                <label htmlFor="f-shake" className="control text-paper-dim">Vertical shake</label>
                                <output htmlFor="f-shake" className="control text-paper-label">{settings.glitch.verticalShake.toFixed(2)}</output>
                            </div>
                            <input
                                id="f-shake"
                                type="range" min="0" max="1" step="0.05"
                                value={settings.glitch.verticalShake}
                                onChange={(e) => updateGlitchSettings({ verticalShake: parseFloat(e.target.value) })}
                            />
                        </div>

                        <div className="mt-sp2 flex flex-col gap-sp1 border-t border-line pt-sp3">
                            <div className="flex justify-between">
                                <label htmlFor="f-float" className="control text-paper-dim">Ambient float</label>
                                <output htmlFor="f-float" className="control text-paper-label">{settings.glitch.baseFloat?.toFixed(2) || "0.10"}</output>
                            </div>
                            <input
                                id="f-float"
                                type="range" min="0" max="0.5" step="0.01"
                                value={settings.glitch.baseFloat ?? 0.1}
                                onChange={(e) => updateGlitchSettings({ baseFloat: parseFloat(e.target.value) })}
                            />
                        </div>

                        <div className="flex flex-col gap-sp1">
                            <div className="flex justify-between">
                                <label htmlFor="f-slices" className="control text-paper-dim">Slices</label>
                                <output htmlFor="f-slices" className="control text-paper-label">{settings.glitch.slices}</output>
                            </div>
                            <input
                                id="f-slices"
                                type="range" min="1" max="50" step="1"
                                value={settings.glitch.slices}
                                onChange={(e) => updateGlitchSettings({ slices: parseInt(e.target.value) })}
                            />
                        </div>

                        <div className="flex flex-col gap-sp1">
                            <div className="flex justify-between">
                                <label htmlFor="f-burst" className="control text-paper-dim">Audio burst gain</label>
                                <output htmlFor="f-burst" className="control text-paper-label">{settings.glitch.burstGain.toFixed(2)}x</output>
                            </div>
                            <input
                                id="f-burst"
                                type="range" min="0" max="3" step="0.05"
                                value={settings.glitch.burstGain}
                                onChange={(e) => updateGlitchSettings({ burstGain: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
}
