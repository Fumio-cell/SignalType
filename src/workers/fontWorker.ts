/// <reference lib="webworker" />
import { parseFontBuffer, parseTypefaceJson, subsetPlan, type ParsedFont, type TypefaceData } from '@/lib/fonts/subset';

/**
 * Parses fonts and converts the glyphs of the typed text to typeface JSON, off the main thread.
 * Parsed fonts stay here, keyed by the caller, so a change of text does not parse the file again.
 * A pinned font (the bundled fallback) is never dropped from the cache.
 */

export type FontWorkerRequest =
    | { type: 'load'; id: number; key: string; buffer: ArrayBuffer; fileName: string; pin?: boolean }
    | { type: 'loadJson'; id: number; key: string; json: unknown }
    | {
          type: 'subset';
          id: number;
          text: string;
          /** One plan per way of drawing: the chosen font and the font that stands in for what it lacks. */
          plans: { key: string; fallbackKey: string | null }[];
      };

export interface FontWorkerPlanResult {
    primary: TypefaceData;
    fallback: TypefaceData | null;
    /** Code points that neither font has. */
    unavailable: number[];
    /** Code points drawn with the fallback font. */
    viaFallback: number[];
}

export type FontWorkerResponse =
    | { type: 'loaded'; id: number; key: string; familyName: string; glyphCount: number; ms: number }
    | { type: 'subset'; id: number; results: FontWorkerPlanResult[]; ms: number }
    | { type: 'error'; id: number; key: string; message: string };

const MAX_CACHED = 3;
const fonts = new Map<string, ParsedFont>();
const pinned = new Map<string, ParsedFont>();

const find = (key: string) => pinned.get(key) ?? fonts.get(key);

function remember(key: string, parsed: ParsedFont, pin?: boolean) {
    if (pin) {
        pinned.set(key, parsed);
        return;
    }
    fonts.set(key, parsed);
    while (fonts.size > MAX_CACHED) fonts.delete(fonts.keys().next().value as string);
}

const post = (m: FontWorkerResponse) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<FontWorkerRequest>) => {
    const msg = e.data;
    const t0 = performance.now();
    const key = msg.type === 'subset' ? '' : msg.key;
    try {
        if (msg.type === 'load') {
            let parsed = find(msg.key);
            if (!parsed) {
                parsed = parseFontBuffer(msg.buffer, msg.fileName);
                remember(msg.key, parsed, msg.pin);
            } else if (msg.pin && !pinned.has(msg.key)) {
                fonts.delete(msg.key);
                pinned.set(msg.key, parsed);
            }
            post({ type: 'loaded', id: msg.id, key: msg.key, familyName: parsed.familyName, glyphCount: parsed.glyphCount, ms: performance.now() - t0 });
        } else if (msg.type === 'loadJson') {
            let parsed = find(msg.key);
            if (!parsed) {
                parsed = parseTypefaceJson(msg.json);
                remember(msg.key, parsed);
            }
            post({ type: 'loaded', id: msg.id, key: msg.key, familyName: parsed.familyName, glyphCount: parsed.glyphCount, ms: performance.now() - t0 });
        } else if (msg.type === 'subset') {
            const results: FontWorkerPlanResult[] = msg.plans.map((plan) => {
                const primary = find(plan.key);
                if (!primary) throw new Error('The font is not loaded in the worker.');
                const fallback = plan.fallbackKey ? find(plan.fallbackKey) ?? null : null;
                const r = subsetPlan(primary, fallback, msg.text);
                return {
                    primary: r.primary.data,
                    fallback: r.fallback ? r.fallback.data : null,
                    unavailable: r.unavailable,
                    viaFallback: r.fallback ? r.fallback.present : [],
                };
            });
            post({ type: 'subset', id: msg.id, results, ms: performance.now() - t0 });
        }
    } catch (err) {
        post({ type: 'error', id: msg.id, key, message: err instanceof Error ? err.message : String(err) });
    }
};
