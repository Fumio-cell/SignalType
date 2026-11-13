import { parse } from 'opentype.js';
import type { Font } from 'opentype.js';
import { extractTTFFromTTC } from './ttc';
import { fullSizeOf } from '../vertical/rules';
import type { GlyphMetrics } from '../vertical/layout';

/**
 * Font parsing and glyph subsetting. This module has no DOM or three dependency: it runs inside
 * workers/fontWorker.ts, so the main thread never parses a font.
 *
 * three's TTFLoader converts every glyph of a font to typeface JSON (7,737 glyphs for Zen Kaku,
 * 15,363 for Shippori Mincho). Text3D only ever draws the characters that are typed, so we parse
 * the font once with opentype's lowMemory mode (glyph outlines are read on demand) and convert
 * only the code points of the current text. The output is the same typeface JSON that TTFLoader
 * produces for those glyphs (same scale, same command encoding, same 'reversed = false').
 */

export interface TypefaceGlyph {
    ha: number;
    x_min: number;
    x_max: number;
    o: string;
}

/** What the vertical layout and the line pitch need to know about the glyphs that were converted. */
export interface FaceMetrics {
    /** Height of the middle of the em box above the baseline, in em. */
    emCenter: number;
    /** Distance between two lines of horizontal text as troika (2D) sets it, in em. */
    pitch2D: number;
    /** The same as Text3D sets it with lineHeight 1, in em. */
    pitch3D: number;
    /** Ink box and advance of each converted character, in em. */
    glyphs: Record<string, GlyphMetrics>;
}

export interface TypefaceData {
    glyphs: Record<string, TypefaceGlyph>;
    familyName: string;
    ascender: number;
    descender: number;
    underlinePosition: number;
    underlineThickness: number;
    boundingBox: { xMin: number; xMax: number; yMin: number; yMax: number };
    resolution: number;
    st: FaceMetrics;
}

/** Text3D's size 1 is 1000 typeface units, which is 0.72 em: one em is 100/72 of the size. */
const EM_PER_SIZE = 100 / 72;

export type ParsedFont =
    | { kind: 'opentype'; font: Font; familyName: string; glyphCount: number }
    | { kind: 'typeface'; json: any; familyName: string; glyphCount: number };

export function parseFontBuffer(arrayBuffer: ArrayBuffer, fileName = ''): ParsedFont {
    let working = arrayBuffer;
    if (arrayBuffer.byteLength >= 4) {
        const isTTC = new DataView(arrayBuffer).getUint32(0, false) === 0x74746366; // 'ttcf'
        if (isTTC || fileName.toLowerCase().endsWith('.dfont')) {
            try {
                working = extractTTFFromTTC(arrayBuffer, 0);
            } catch {
                // Not a collection after all: parse the bytes as they are.
            }
        }
    }
    const font: Font = (parse as unknown as (b: ArrayBuffer, o: { lowMemory: boolean }) => Font)(working, { lowMemory: true });
    if (!font || !font.glyphs) throw new Error('Failed to parse font data.');
    return {
        kind: 'opentype',
        font,
        familyName: font.getEnglishName('fullName') || font.getEnglishName('fontFamily') || fileName,
        glyphCount: font.numGlyphs,
    };
}

/** A ready-made typeface JSON (the Inter Bold preset) as a font source. */
export function parseTypefaceJson(json: any): ParsedFont {
    if (!json || !json.glyphs) throw new Error('Not a typeface JSON font.');
    return { kind: 'typeface', json, familyName: json.familyName || '', glyphCount: Object.keys(json.glyphs).length };
}

/** The code points of `text` that need a glyph: every one except line breaks, once each, in order. */
export function requiredCodePoints(text: string): number[] {
    const seen = new Set<number>();
    for (const ch of text) {
        const cp = ch.codePointAt(0)!;
        if (cp === 0x0a || cp === 0x0d) continue;
        seen.add(cp);
    }
    return [...seen];
}

export function hasGlyph(parsed: ParsedFont, cp: number): boolean {
    if (parsed.kind === 'typeface') return String.fromCodePoint(cp) in parsed.json.glyphs;
    const index = (parsed.font as any).encoding.cmap.glyphIndexMap[cp];
    return index !== undefined && index !== 0;
}

interface Converted {
    glyph: TypefaceGlyph;
    metrics: GlyphMetrics;
}

/** y values of every point of a typeface outline string ("m x y l x y q x y cx cy b ..."). */
function outlineBounds(o: string): { yMin: number; yMax: number } {
    const t = o.split(' ');
    let yMin = Infinity;
    let yMax = -Infinity;
    let i = 0;
    while (i < t.length) {
        // commands are followed by coordinate pairs
        i++;
        while (i + 1 < t.length && t[i] !== '' && !Number.isNaN(Number(t[i]))) {
            const y = Number(t[i + 1]);
            if (y < yMin) yMin = y;
            if (y > yMax) yMax = y;
            i += 2;
        }
    }
    return yMin === Infinity ? { yMin: 0, yMax: 0 } : { yMin, yMax };
}

function convertGlyph(parsed: ParsedFont, cp: number): Converted {
    const ch = String.fromCodePoint(cp);
    if (parsed.kind === 'typeface') {
        const g = parsed.json.glyphs[ch] as TypefaceGlyph;
        const em = parsed.json.resolution * EM_PER_SIZE;
        const { yMin, yMax } = outlineBounds(g.o || '');
        return {
            glyph: { ha: g.ha, x_min: g.x_min, x_max: g.x_max, o: g.o },
            metrics: { adv: g.ha / em, xMin: g.x_min / em, xMax: g.x_max / em, yMin: yMin / em, yMax: yMax / em },
        };
    }
    const { font } = parsed;
    const upm = font.unitsPerEm || 2048;
    const scale = 100000 / (upm * 72);
    const index = (font as any).encoding.cmap.glyphIndexMap[cp] as number;
    const glyph = font.glyphs.get(index);
    const commands = glyph.path.commands as any[];
    const round = Math.round;
    let o = '';
    for (const c of commands) {
        const type = c.type === 'C' ? 'b' : (c.type as string).toLowerCase();
        o += type + ' ';
        if (c.x !== undefined && c.y !== undefined) o += round(c.x * scale) + ' ' + round(c.y * scale) + ' ';
        if (c.x1 !== undefined && c.y1 !== undefined) o += round(c.x1 * scale) + ' ' + round(c.y1 * scale) + ' ';
        if (c.x2 !== undefined && c.y2 !== undefined) o += round(c.x2 * scale) + ' ' + round(c.y2 * scale) + ' ';
    }
    let ink = { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
    if (commands.length > 0) {
        const bb = glyph.path.getBoundingBox();
        ink = { xMin: bb.x1 / upm, xMax: bb.x2 / upm, yMin: bb.y1 / upm, yMax: bb.y2 / upm };
    }
    return {
        glyph: {
            ha: round((glyph.advanceWidth ?? 0) * scale),
            x_min: round((glyph.xMin ?? 0) * scale),
            x_max: round((glyph.xMax ?? 0) * scale),
            o,
        },
        metrics: { adv: (glyph.advanceWidth ?? 0) / upm, ...ink },
    };
}

/** Face-wide numbers: where the em box sits and how far apart horizontal lines are. */
function faceMetrics(parsed: ParsedFont): Omit<FaceMetrics, 'glyphs'> {
    if (parsed.kind === 'typeface') {
        const j = parsed.json;
        const em = j.resolution * EM_PER_SIZE;
        const pitch3D = (j.boundingBox.yMax - j.boundingBox.yMin + (j.underlineThickness || 0)) / j.resolution / EM_PER_SIZE;
        return { emCenter: (j.ascender + j.descender) / 2 / em, pitch2D: pitch3D, pitch3D };
    }
    const { font } = parsed;
    const t = (font as any).tables;
    const upm = font.unitsPerEm || 2048;
    // The em box of a CJK font sits between the typographic ascender and descender.
    const os2 = t.os2;
    const useTypo = os2 && typeof os2.sTypoAscender === 'number' && os2.sTypoAscender > os2.sTypoDescender;
    const emCenter = useTypo ? (os2.sTypoAscender + os2.sTypoDescender) / 2 / upm : (font.ascender + font.descender) / 2 / upm;
    const hhea = t.hhea || {};
    const pitch2D = ((hhea.ascender ?? font.ascender) - (hhea.descender ?? font.descender) + (hhea.lineGap ?? 0)) / upm;
    const head = t.head || {};
    const pitch3D = ((head.yMax ?? 1000) - (head.yMin ?? 0) + (t.post?.underlineThickness ?? 0)) / 1000 / EM_PER_SIZE;
    return { emCenter, pitch2D, pitch3D };
}

export interface SubsetResult {
    data: TypefaceData;
    /** Code points that are in `data.glyphs`. */
    present: number[];
}

/** Convert exactly these code points (all of which the font has) to typeface JSON. */
export function subsetCodePoints(parsed: ParsedFont, codePoints: number[]): SubsetResult {
    const glyphs: Record<string, TypefaceGlyph> = {};
    const metrics: Record<string, GlyphMetrics> = {};
    for (const cp of codePoints) {
        const ch = String.fromCodePoint(cp);
        const c = convertGlyph(parsed, cp);
        glyphs[ch] = c.glyph;
        metrics[ch] = c.metrics;
        // A small kana is placed against the full-size kana of the same font.
        const full = fullSizeOf(ch);
        if (full && hasGlyph(parsed, full.codePointAt(0)!)) {
            const f = convertGlyph(parsed, full.codePointAt(0)!).metrics;
            c.metrics.ref = { adv: f.adv, xMax: f.xMax, yMax: f.yMax };
        }
    }
    const fm = faceMetrics(parsed);

    if (parsed.kind === 'typeface') {
        const j = parsed.json;
        return {
            data: {
                glyphs,
                familyName: j.familyName,
                ascender: j.ascender,
                descender: j.descender,
                underlinePosition: j.underlinePosition,
                underlineThickness: j.underlineThickness,
                boundingBox: j.boundingBox,
                resolution: j.resolution,
                st: { ...fm, glyphs: metrics },
            },
            present: codePoints,
        };
    }

    const { font } = parsed;
    const round = Math.round;
    const scale = 100000 / ((font.unitsPerEm || 2048) * 72);
    const tables = (font as any).tables;
    return {
        data: {
            glyphs,
            familyName: parsed.familyName,
            ascender: round(font.ascender * scale),
            descender: round(font.descender * scale),
            underlinePosition: tables.post?.underlinePosition ?? 0,
            underlineThickness: tables.post?.underlineThickness ?? 0,
            // Text3D (drei) reads the bounding box; fall back like the old loader did.
            boundingBox: {
                xMin: tables.head?.xMin ?? 0,
                xMax: tables.head?.xMax ?? 1000,
                yMin: tables.head?.yMin ?? 0,
                yMax: tables.head?.yMax ?? 1000,
            },
            resolution: 1000,
            st: { ...fm, glyphs: metrics },
        },
        present: codePoints,
    };
}

export interface PlanResult {
    /** The characters the chosen font has. */
    primary: SubsetResult;
    /** The characters only the fallback font has, or null when none were needed. */
    fallback: SubsetResult | null;
    /** Code points that neither font has. */
    unavailable: number[];
}

/**
 * Split the typed characters between the chosen font and the fallback font and convert each share.
 * A character goes to the chosen font if it has it, else to the fallback, else it is unavailable.
 */
export function subsetPlan(primary: ParsedFont, fallback: ParsedFont | null, text: string): PlanResult {
    const own: number[] = [];
    const rest: number[] = [];
    for (const cp of requiredCodePoints(text)) (hasGlyph(primary, cp) ? own : rest).push(cp);
    const viaFallback: number[] = [];
    const unavailable: number[] = [];
    for (const cp of rest) (fallback && hasGlyph(fallback, cp) ? viaFallback : unavailable).push(cp);
    return {
        primary: subsetCodePoints(primary, own),
        fallback: fallback && viaFallback.length > 0 ? subsetCodePoints(fallback, viaFallback) : null,
        unavailable,
    };
}
