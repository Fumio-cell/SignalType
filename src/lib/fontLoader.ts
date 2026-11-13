import { create } from 'zustand';
import FontWorker from '@/workers/fontWorker?worker';
import type { FontWorkerPlanResult, FontWorkerRequest, FontWorkerResponse } from '@/workers/fontWorker';
import { useAppStore } from '@/store/appStore';
import { dismissNotice, notify } from '@/lib/notify';
import { DEFAULT_FONT, type PresetFont } from '@/lib/fonts/presets';
import type { Face, FacePair } from '@/types/state';

/**
 * The one way a font gets into the app. The ControlPanel button, the drop handler and the preset
 * menu all end up in activateFont().
 *
 * A TTF is parsed once in a worker (src/workers/fontWorker.ts). The worker converts only the glyphs
 * of the typed text to typeface JSON (3D text, and the metrics the layout needs); this module
 * re-requests that whenever the text changes. 2D text (troika) takes the font file by URL.
 *
 * Fallback: a character the chosen font lacks is drawn with the bundled Zen Kaku Gothic New. The
 * worker splits the text between the two fonts; the stage draws each character with the font whose
 * converted glyphs hold it. A character neither font has is reported and left out.
 */

type Request =
    | Omit<Extract<FontWorkerRequest, { type: 'load' }>, 'id'>
    | Omit<Extract<FontWorkerRequest, { type: 'loadJson' }>, 'id'>
    | Omit<Extract<FontWorkerRequest, { type: 'subset' }>, 'id'>;

const FALLBACK = DEFAULT_FONT;
const FALLBACK_NAME = 'Zen Kaku Gothic New';
const FALLBACK_KEY = `preset:${FALLBACK.url}`;

let worker: Worker | null = null;
let nextId = 0;
const waiting = new Map<number, { resolve: (r: FontWorkerResponse) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
    if (worker) return worker;
    const w = new FontWorker();
    w.onmessage = (e: MessageEvent<FontWorkerResponse>) => {
        const entry = waiting.get(e.data.id);
        if (!entry) return;
        waiting.delete(e.data.id);
        if (e.data.type === 'error') entry.reject(new Error(e.data.message));
        else entry.resolve(e.data);
    };
    w.onerror = (e) => {
        const err = new Error(e.message || 'The font worker stopped.');
        for (const entry of waiting.values()) entry.reject(err);
        waiting.clear();
        worker = null;
        active = null;
        fallbackReady = null;
    };
    worker = w;
    return w;
}

function call(request: Request, transfer: Transferable[] = []): Promise<FontWorkerResponse> {
    return new Promise((resolve, reject) => {
        const id = ++nextId;
        waiting.set(id, { resolve, reject });
        getWorker().postMessage({ ...request, id }, transfer);
    });
}

/** What the UI shows about font work in progress. */
export const useFontStatus = create<{ busy: boolean }>(() => ({ busy: false }));

interface Plan {
    key: string;
    fallbackKey: string | null;
}
interface Active {
    plans: Plan[]; // [3D] or [3D, 2D]
    url2D: string;
    url3D: string;
}
let active: Active | null = null; // the font the worker holds for the current text
let lastResults: FontWorkerPlanResult[] | null = null;
let fallbackReady: Promise<void> | null = null;
let activationSeq = 0; // a newer font choice supersedes an older one still loading
let subsetSeq = 0; // a newer text supersedes an older conversion
let inFlight = 0;
let debounceTimer: number | null = null;
let ownedBlobUrl: string | null = null;
let fileCounter = 0;

function setBusy() {
    useFontStatus.setState({ busy: inFlight > 0 || debounceTimer !== null });
}

function describe(cp: number): string {
    const ch = String.fromCodePoint(cp);
    return /\s|\p{C}/u.test(ch) ? `U+${cp.toString(16).toUpperCase().padStart(4, '0')}` : ch;
}

function reportMissing(missing: number[]) {
    if (missing.length === 0) {
        dismissNotice('font-missing');
        return;
    }
    const shown = missing.slice(0, 12).map(describe).join(' ');
    const more = missing.length > 12 ? ` and ${missing.length - 12} more` : '';
    notify(`No glyph in this font or in ${FALLBACK_NAME} for: ${shown}${more}.`, { id: 'font-missing' });
}

function reportFallback(count: number) {
    if (count === 0) {
        dismissNotice('font-fallback');
        return;
    }
    notify(`${count} character${count === 1 ? '' : 's'} drawn with ${FALLBACK_NAME}.`, { id: 'font-fallback' });
}

/** Tell the user what the current text needed from the fallback, for the mode they are in. */
function report(text: string, results: FontWorkerPlanResult[]) {
    const mode = useAppStore.getState().settings.render.textMode;
    const r = mode === '3D' ? results[0] : results[results.length - 1];
    const viaFallback = new Set(r.viaFallback);
    let drawn = 0;
    for (const ch of text) if (!/\s/.test(ch) && viaFallback.has(ch.codePointAt(0)!)) drawn++;
    reportFallback(drawn);
    reportMissing(r.unavailable);
}

/** The bundled fallback font, loaded once and kept in the worker whatever else is chosen. */
function ensureFallback(): Promise<void> {
    if (!fallbackReady) {
        fallbackReady = (async () => {
            const res = await fetch(FALLBACK.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buffer = await res.arrayBuffer();
            const r = await call({ type: 'load', key: FALLBACK_KEY, buffer, fileName: FALLBACK.label, pin: true }, [buffer]);
            if (r.type !== 'loaded') throw new Error('Unexpected worker reply.');
        })().catch((err) => {
            fallbackReady = null;
            throw err;
        });
    }
    return fallbackReady;
}

/** Convert the glyphs of `text` for every plan. */
async function convert(plans: Plan[], text: string) {
    const r = await call({ type: 'subset', plans, text });
    if (r.type !== 'subset') throw new Error('Unexpected worker reply.');
    return r.results;
}

function toPair(primaryUrl: string, r: FontWorkerPlanResult): FacePair {
    const primary: Face = { url: primaryUrl, data: r.primary };
    const fallback: Face | null = r.fallback ? { url: FALLBACK.url, data: r.fallback } : null;
    return { primary, fallback };
}

/** The faces of every mode, from the worker's results (one result when 2D and 3D draw with the same font). */
function toFaces(a: Active, results: FontWorkerPlanResult[]) {
    const faces3D = toPair(a.url3D, results[0]);
    const faces2D = results.length > 1 ? toPair(a.url2D, results[1]) : faces3D;
    return { faces3D, faces2D };
}

async function activateFont(opts: {
    key: string;
    label: string;
    /** The value kept in settings.render.font. */
    name: string;
    /** The font file's URL, for 2D text. */
    url: string;
    getBuffer: () => Promise<ArrayBuffer>;
    blobUrl?: string;
    /** A ready-made typeface JSON that 3D text uses instead of a font file (Inter Bold). 2D text then uses the fallback font. */
    jsonUrl?: string;
}): Promise<void> {
    const token = ++activationSeq;
    let committed = false;
    inFlight++;
    setBusy();
    try {
        const needsFallback = opts.key !== FALLBACK_KEY;
        const fallbackLoad = needsFallback || opts.jsonUrl ? ensureFallback() : Promise.resolve();
        if (opts.jsonUrl) {
            const res = await fetch(opts.jsonUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (token !== activationSeq) return;
            const loaded = await call({ type: 'loadJson', key: opts.key, json });
            if (loaded.type !== 'loaded') throw new Error('Unexpected worker reply.');
        } else {
            const buffer = await opts.getBuffer();
            if (token !== activationSeq) return;
            const loaded = await call(
                { type: 'load', key: opts.key, buffer, fileName: opts.label, pin: opts.key === FALLBACK_KEY },
                [buffer],
            );
            if (loaded.type !== 'loaded') throw new Error('Unexpected worker reply.');
        }
        await fallbackLoad;
        if (token !== activationSeq) return;

        const next: Active = opts.jsonUrl
            ? {
                  // 3D: the JSON font, then the fallback; 2D: the fallback font alone.
                  plans: [{ key: opts.key, fallbackKey: FALLBACK_KEY }, { key: FALLBACK_KEY, fallbackKey: null }],
                  url3D: '',
                  url2D: FALLBACK.url,
              }
            : {
                  plans: [{ key: opts.key, fallbackKey: needsFallback ? FALLBACK_KEY : null }],
                  url3D: opts.url,
                  url2D: opts.url,
              };
        const text = useAppStore.getState().settings.render.text;
        const results = await convert(next.plans, text);
        if (token !== activationSeq) return;

        committed = true;
        active = next;
        lastResults = results;
        const previousBlob = ownedBlobUrl;
        ownedBlobUrl = opts.blobUrl ?? null;
        // One update: both faces and the name change together, so no frame mixes two fonts.
        useAppStore.getState().updateRenderSettings({ font: opts.name, ...toFaces(next, results) });
        performance.mark('font:data-ready');
        if (previousBlob && previousBlob !== ownedBlobUrl) URL.revokeObjectURL(previousBlob);
        dismissNotice('font-load');
        report(text, results);
        // The text may have changed while this font was loading.
        if (useAppStore.getState().settings.render.text !== text) scheduleSubset();
    } catch (err) {
        if (token === activationSeq) {
            console.error('Font load failed:', err);
            notify(`Failed to load font ${opts.label}: ${err instanceof Error ? err.message : String(err)}`, { id: 'font-load', tone: 'error' });
        }
    } finally {
        // A font that never became the active one leaves its blob URL behind otherwise.
        if (!committed && opts.blobUrl) URL.revokeObjectURL(opts.blobUrl);
        inFlight--;
        setBusy();
    }
}

/** Import a font file the user chose or dropped (.ttf, .otf, .ttc, .dfont). */
export function importFontFile(file: File): Promise<void> {
    const blobUrl = URL.createObjectURL(file);
    return activateFont({
        key: `file:${++fileCounter}:${file.name}`,
        label: file.name,
        name: file.name,
        url: blobUrl,
        blobUrl,
        getBuffer: () => file.arrayBuffer(),
    });
}

/** Choose one of the bundled fonts. */
export async function selectPresetFont(preset: PresetFont): Promise<void> {
    await activateFont({
        key: preset.isTTF ? `preset:${preset.url}` : `json:${preset.url}`,
        label: preset.label,
        name: preset.url,
        url: preset.isTTF ? preset.url : '',
        jsonUrl: preset.isTTF ? undefined : preset.url,
        getBuffer: async () => {
            const res = await fetch(preset.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.arrayBuffer();
        },
    });
}

/** Re-convert for the new text, a moment after the last keystroke. */
function scheduleSubset() {
    if (debounceTimer !== null) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(async () => {
        debounceTimer = null;
        const current = active;
        if (!current) {
            setBusy();
            return;
        }
        const token = ++subsetSeq;
        const text = useAppStore.getState().settings.render.text;
        inFlight++;
        setBusy();
        try {
            const results = await convert(current.plans, text);
            if (token !== subsetSeq || current !== active) return;
            lastResults = results;
            useAppStore.getState().updateRenderSettings(toFaces(current, results));
            performance.mark('font:data-ready');
            report(text, results);
        } catch (err) {
            console.error('Glyph conversion failed:', err);
            notify(`Could not read glyphs from the font: ${err instanceof Error ? err.message : String(err)}`, { id: 'font-load', tone: 'error' });
        } finally {
            inFlight--;
            setBusy();
        }
    }, 120);
    setBusy();
}

/** Resolves when no font load or text conversion is pending. The export waits for this. */
export async function fontSettled(timeoutMs = 15000): Promise<void> {
    const t0 = Date.now();
    while ((inFlight > 0 || debounceTimer !== null) && Date.now() - t0 < timeoutMs) {
        await new Promise((r) => setTimeout(r, 20));
    }
}

let started = false;

/** Called once at startup: loads the default font and follows the text. */
export function initFonts(): void {
    if (started) return;
    started = true;
    let lastText = useAppStore.getState().settings.render.text;
    let lastMode = useAppStore.getState().settings.render.textMode;
    useAppStore.subscribe((state) => {
        const text = state.settings.render.text;
        const mode = state.settings.render.textMode;
        if (mode !== lastMode) {
            lastMode = mode;
            // 2D and 3D can draw with different fonts (the Inter Bold preset): say what this mode needed.
            if (lastResults && text === lastText) report(text, lastResults);
        }
        if (text === lastText) return;
        lastText = text;
        scheduleSubset();
    });
    void selectPresetFont(DEFAULT_FONT);
}
