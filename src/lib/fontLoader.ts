import { create } from 'zustand';
import FontWorker from '@/workers/fontWorker?worker';
import type { FontWorkerRequest, FontWorkerResponse } from '@/workers/fontWorker';
import { useAppStore } from '@/store/appStore';
import { dismissNotice, notify } from '@/lib/notify';
import { DEFAULT_FONT, type PresetFont } from '@/lib/fonts/presets';

/**
 * The one way a font gets into the app. The ControlPanel button, the drop handler and the preset
 * menu all end up in activateFont().
 *
 * A TTF is parsed once in a worker (src/workers/fontWorker.ts). For 3D text the worker converts
 * only the glyphs of the typed text to typeface JSON; this module re-requests that whenever the
 * text changes. 2D text (troika) takes the font file by URL.
 */

type Request =
    | Omit<Extract<FontWorkerRequest, { type: 'load' }>, 'id'>
    | Omit<Extract<FontWorkerRequest, { type: 'subset' }>, 'id'>;

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
        activeKey = null;
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

let activeKey: string | null = null; // the font the worker holds for the current text
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
    notify(`This font has no glyph for: ${shown}${more}.`, { id: 'font-missing' });
}

/** Convert the glyphs of `text` with the font the worker holds under `key`. */
async function convert(key: string, text: string) {
    const r = await call({ type: 'subset', key, text });
    if (r.type !== 'subset') throw new Error('Unexpected worker reply.');
    return r;
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
    /** A ready-made typeface JSON that 3D text uses instead of this font (Inter Bold). This font then only serves 2D text. */
    json3DUrl?: string;
}): Promise<void> {
    const token = ++activationSeq;
    let committed = false;
    inFlight++;
    setBusy();
    try {
        const buffer = await opts.getBuffer();
        if (token !== activationSeq) return;
        const loaded = await call({ type: 'load', key: opts.key, buffer, fileName: opts.label }, [buffer]);
        if (token !== activationSeq) return;
        if (loaded.type !== 'loaded') throw new Error('Unexpected worker reply.');
        const text = useAppStore.getState().settings.render.text;
        const r = await convert(opts.key, text);
        if (token !== activationSeq) return;

        committed = true;
        activeKey = opts.key;
        const previousBlob = ownedBlobUrl;
        ownedBlobUrl = opts.blobUrl ?? null;
        // One update: 3D data and 2D url change together, so no frame mixes two fonts.
        useAppStore.getState().updateRenderSettings(
            opts.json3DUrl
                ? { font: opts.json3DUrl, json3D: true, customFontUrl: opts.url, customFontData: r.data }
                : { font: opts.name, json3D: false, customFontUrl: opts.url, customFontData: r.data },
        );
        performance.mark('font:data-ready');
        if (previousBlob && previousBlob !== ownedBlobUrl) URL.revokeObjectURL(previousBlob);
        dismissNotice('font-load');
        // With a JSON font in 3D the glyphs of this font are not what is drawn, so there is nothing to report.
        reportMissing(opts.json3DUrl ? [] : r.missing);
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
    // A ready-made typeface JSON (Inter Bold) draws 3D text; 2D text and the glyph check stay on the
    // default font, so the file that 2D text loads is always one whose glyph coverage is known.
    const file = preset.isTTF ? preset : DEFAULT_FONT;
    await activateFont({
        key: `preset:${file.url}`,
        label: file.label,
        name: preset.url,
        url: file.url,
        json3DUrl: preset.isTTF ? undefined : preset.url,
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
        const key = activeKey;
        if (!key) {
            setBusy();
            return;
        }
        const token = ++subsetSeq;
        const text = useAppStore.getState().settings.render.text;
        inFlight++;
        setBusy();
        try {
            const r = await convert(key, text);
            if (token !== subsetSeq || key !== activeKey) return;
            useAppStore.getState().updateRenderSettings({ customFontData: r.data });
            performance.mark('font:data-ready');
            if (!useAppStore.getState().settings.render.json3D) reportMissing(r.missing);
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
    useAppStore.subscribe((state) => {
        const text = state.settings.render.text;
        if (text === lastText) return;
        lastText = text;
        scheduleSubset();
    });
    void selectPresetFont(DEFAULT_FONT);
}
