/// <reference lib="webworker" />
import { parseFontBuffer, subsetTypeface, type ParsedFont, type TypefaceData } from '@/lib/fonts/subset';

/**
 * Parses fonts and converts the glyphs of the typed text to typeface JSON, off the main thread.
 * Parsed fonts stay here, keyed by the caller, so a change of text does not parse the file again.
 */

export type FontWorkerRequest =
    | { type: 'load'; id: number; key: string; buffer: ArrayBuffer; fileName: string }
    | { type: 'subset'; id: number; key: string; text: string };

export type FontWorkerResponse =
    | { type: 'loaded'; id: number; key: string; familyName: string; glyphCount: number; ms: number }
    | { type: 'subset'; id: number; key: string; data: TypefaceData; missing: number[]; present: number[]; ms: number }
    | { type: 'error'; id: number; key: string; message: string };

const MAX_CACHED = 3;
const fonts = new Map<string, ParsedFont>();

const post = (m: FontWorkerResponse) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<FontWorkerRequest>) => {
    const msg = e.data;
    const t0 = performance.now();
    try {
        if (msg.type === 'load') {
            let parsed = fonts.get(msg.key);
            if (!parsed) {
                parsed = parseFontBuffer(msg.buffer, msg.fileName);
                fonts.set(msg.key, parsed);
                while (fonts.size > MAX_CACHED) fonts.delete(fonts.keys().next().value as string);
            }
            post({ type: 'loaded', id: msg.id, key: msg.key, familyName: parsed.familyName, glyphCount: parsed.glyphCount, ms: performance.now() - t0 });
        } else if (msg.type === 'subset') {
            const parsed = fonts.get(msg.key);
            if (!parsed) throw new Error('The font is not loaded in the worker.');
            const { data, missing, present } = subsetTypeface(parsed, msg.text);
            post({ type: 'subset', id: msg.id, key: msg.key, data, missing, present, ms: performance.now() - t0 });
        }
    } catch (err) {
        post({ type: 'error', id: msg.id, key: msg.key, message: err instanceof Error ? err.message : String(err) });
    }
};
