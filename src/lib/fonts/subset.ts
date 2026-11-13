import { parse } from 'opentype.js';
import type { Font } from 'opentype.js';
import { extractTTFFromTTC } from './ttc';

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

export interface TypefaceData {
    glyphs: Record<string, TypefaceGlyph>;
    familyName: string;
    ascender: number;
    descender: number;
    underlinePosition: number;
    underlineThickness: number;
    boundingBox: { xMin: number; xMax: number; yMin: number; yMax: number };
    resolution: number;
}

export interface ParsedFont {
    font: Font;
    familyName: string;
    glyphCount: number;
}

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
        font,
        familyName: font.getEnglishName('fullName') || font.getEnglishName('fontFamily') || fileName,
        glyphCount: font.numGlyphs,
    };
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

export interface SubsetResult {
    data: TypefaceData;
    /** Code points of the text that the font has no glyph for. */
    missing: number[];
    /** Code points that are in `data.glyphs`. */
    present: number[];
}

export function subsetTypeface(parsed: ParsedFont, text: string): SubsetResult {
    const { font } = parsed;
    const round = Math.round;
    const scale = 100000 / ((font.unitsPerEm || 2048) * 72);
    const glyphIndexMap: Record<string, number> = (font as any).encoding.cmap.glyphIndexMap;

    const glyphs: Record<string, TypefaceGlyph> = {};
    const present: number[] = [];
    const missing: number[] = [];

    for (const cp of requiredCodePoints(text)) {
        const index = glyphIndexMap[cp];
        if (index === undefined || index === 0) {
            missing.push(cp);
            continue;
        }
        const glyph = font.glyphs.get(index);
        let o = '';
        for (const c of glyph.path.commands as any[]) {
            const type = c.type === 'C' ? 'b' : (c.type as string).toLowerCase();
            o += type + ' ';
            if (c.x !== undefined && c.y !== undefined) o += round(c.x * scale) + ' ' + round(c.y * scale) + ' ';
            if (c.x1 !== undefined && c.y1 !== undefined) o += round(c.x1 * scale) + ' ' + round(c.y1 * scale) + ' ';
            if (c.x2 !== undefined && c.y2 !== undefined) o += round(c.x2 * scale) + ' ' + round(c.y2 * scale) + ' ';
        }
        glyphs[String.fromCodePoint(cp)] = {
            ha: round((glyph.advanceWidth ?? 0) * scale),
            x_min: round((glyph.xMin ?? 0) * scale),
            x_max: round((glyph.xMax ?? 0) * scale),
            o,
        };
        present.push(cp);
    }

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
        },
        missing,
        present,
    };
}
