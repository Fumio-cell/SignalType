import { isAscii, isAsciiAlnum, isRotatedChar, isShiftedPunctuation, fullSizeOf } from './rules';

/**
 * Typesetting for text that is drawn one piece at a time (vertical writing, and any text that needs
 * more than one font). Pure arithmetic: no DOM, no three. All lengths are in em.
 *
 * Frame: x to the right, y up, origin at the middle of the finished block.
 * A piece is drawn like this (a, b = anchor x, y; s = scale; r = rotation, counter-clockwise):
 *   translate(a, b) rotate(r) scale(s) translate(ox, oy)   then the glyph run with its origin
 * where the glyph origin is the left end of the baseline.
 */

/** Ink box and advance of one glyph, in em, y up from the baseline. */
export interface GlyphMetrics {
    adv: number;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    /** For a small kana: the full-size kana of the same font that it is aligned to. */
    ref?: { adv: number; xMax: number; yMax: number };
}

/** 'p': the font the user chose. 'f': the bundled fallback font. */
export type FontSlot = 'p' | 'f';

export interface Drawable {
    slot: FontSlot;
    m: GlyphMetrics;
}

/** The glyph a character is drawn with, or null when no font has one (it is left out). */
export type Lookup = (ch: string) => Drawable | null;

/** Height of the middle of the em box above the baseline, per font. */
export type EmCenters = Record<FontSlot, number>;

export interface Piece {
    text: string;
    slot: FontSlot;
    x: number;
    y: number;
    /** Radians, counter-clockwise. -PI/2 is a quarter turn clockwise. */
    rot: number;
    scale: number;
    ox: number;
    oy: number;
}

export interface Layout {
    pieces: Piece[];
    /** Size of the grid box the pieces are centred in. */
    width: number;
    height: number;
}

const CLOCKWISE = -Math.PI / 2;

/** Where the ink of a glyph sits in its cell, as distances from the left and bottom edge of the em cell. */
function cellInk(m: GlyphMetrics, emC: number) {
    const left = (1 - m.adv) / 2 + m.xMin;
    const right = (1 - m.adv) / 2 + m.xMax;
    const bottom = m.yMin - emC + 0.5;
    const top = m.yMax - emC + 0.5;
    return { left, right, bottom, top };
}

/**
 * Translation that moves a glyph from its horizontal place to its vertical place.
 *  Punctuation (。 、 ， ．): mirror the ink inside the cell, lower left -> upper right:
 *      dx = em - inkRight - inkLeft,  dy = em - inkTop - inkBottom
 *  Small kana: line the ink up with the upper right corner of the full-size kana. The mirror of the
 *      brief is not used here: Zen Kaku Gothic New draws small kana horizontally centred in the cell,
 *      so the mirror leaves them in the middle (0.9 % of an em for ゃ). Aligning to the full-size
 *      kana's right and top edges is derived from the font's own outlines as well and holds for
 *      fonts that centre their small kana and for fonts that set them low and left.
 */
function verticalShift(ch: string, m: GlyphMetrics, emC: number): [number, number] {
    const ink = cellInk(m, emC);
    if (isShiftedPunctuation(ch)) return [1 - ink.right - ink.left, 1 - ink.top - ink.bottom];
    if (fullSizeOf(ch)) {
        if (m.ref) {
            const full = cellInk({ ...m, adv: m.ref.adv, xMin: 0, xMax: m.ref.xMax, yMin: 0, yMax: m.ref.yMax }, emC);
            return [full.right - ink.right, full.top - ink.top];
        }
        return [1 - ink.right - ink.left, 1 - ink.top - ink.bottom];
    }
    return [0, 0];
}

/**
 * Vertical writing. One character per 1 em square cell, top to bottom; lines are columns from right
 * to left, `pitch` em apart (the column centre of line 0 is the rightmost).
 */
export function layoutVertical(lines: string[], lookup: Lookup, emC: EmCenters, pitch: number): Layout {
    const pieces: Piece[] = [];
    let longest = 0;

    lines.forEach((line, c) => {
        const cx = -c * pitch;
        let cursor = 0; // em used so far in this column, from the top
        const chars = Array.from(line);

        for (let i = 0; i < chars.length; ) {
            const ch = chars[i];
            const g = lookup(ch);
            if (!g) {
                i++;
                continue;
            }

            if (isAsciiAlnum(ch)) {
                // A run of half-width digits / Latin letters in one font.
                let j = i;
                let length = 0;
                while (j < chars.length && isAsciiAlnum(chars[j])) {
                    const gj = lookup(chars[j]);
                    if (!gj || gj.slot !== g.slot) break;
                    length += gj.m.adv;
                    j++;
                }
                const run = chars.slice(i, j).join('');
                const count = j - i;
                i = j;
                if (count <= 2) {
                    // Tate-chu-yoko: upright, side by side, inside one cell (narrowed if wider than the cell).
                    pieces.push({
                        text: run, slot: g.slot,
                        x: cx, y: -(cursor + 0.5),
                        rot: 0, scale: length > 1 ? 1 / length : 1,
                        ox: -length / 2, oy: -emC[g.slot],
                    });
                    cursor += 1;
                } else {
                    // The whole run turned a quarter clockwise: one vertical bar.
                    pieces.push({
                        text: run, slot: g.slot,
                        x: cx, y: -(cursor + length / 2),
                        rot: CLOCKWISE, scale: 1,
                        ox: -length / 2, oy: -emC[g.slot],
                    });
                    cursor += length;
                }
                continue;
            }

            i++;
            const { adv } = g.m;

            if (ch === ' ') {
                cursor += adv;
                continue;
            }

            if (isRotatedChar(ch) || isAscii(ch)) {
                // Full-width characters take a whole cell; half-width ones (ASCII brackets and so on) their advance.
                const length = adv >= 0.9 ? 1 : adv;
                pieces.push({
                    text: ch, slot: g.slot,
                    x: cx, y: -(cursor + length / 2),
                    rot: CLOCKWISE, scale: 1,
                    ox: -adv / 2, oy: -emC[g.slot],
                });
                cursor += length;
                continue;
            }

            const [dx, dy] = verticalShift(ch, g.m, emC[g.slot]);
            pieces.push({
                text: ch, slot: g.slot,
                x: cx, y: -(cursor + 0.5),
                rot: 0, scale: 1,
                ox: -adv / 2 + dx, oy: -emC[g.slot] + dy,
            });
            cursor += 1;
        }
        longest = Math.max(longest, cursor);
    });

    const width = Math.max(0, lines.length - 1) * pitch + 1;
    const shiftX = (Math.max(0, lines.length - 1) * pitch) / 2;
    const shiftY = longest / 2;
    for (const p of pieces) {
        p.x += shiftX;
        p.y += shiftY;
    }
    return { pieces, width, height: longest };
}

/**
 * Horizontal text as one piece per run of characters in the same font. Used only when a line needs
 * more than one font; text in a single font stays one troika / Text3D element.
 */
export function layoutHorizontal(
    lines: string[],
    lookup: Lookup,
    emC: EmCenters,
    pitch: number,
    align: 'left' | 'center',
): Layout {
    interface Run { text: string; slot: FontSlot; x: number }
    const rows: { runs: Run[]; width: number }[] = lines.map((line) => {
        const runs: Run[] = [];
        let pen = 0;
        let open: Run | null = null;
        for (const ch of Array.from(line)) {
            const g = lookup(ch);
            if (!g) continue;
            if (ch === ' ') {
                // Spaces only move the pen, so no piece starts or ends with white space.
                open = null;
                pen += g.m.adv;
                continue;
            }
            if (!open || open.slot !== g.slot) {
                open = { text: '', slot: g.slot, x: pen };
                runs.push(open);
            }
            open.text += ch;
            pen += g.m.adv;
        }
        return { runs, width: pen };
    });

    const maxWidth = Math.max(0, ...rows.map((r) => r.width));
    const pieces: Piece[] = [];
    rows.forEach((row, l) => {
        const start = align === 'center' ? (maxWidth - row.width) / 2 : 0;
        for (const run of row.runs) {
            pieces.push({
                text: run.text, slot: run.slot,
                x: start + run.x - maxWidth / 2,
                y: -l * pitch,
                rot: 0, scale: 1, ox: 0, oy: 0,
            });
        }
    });

    const n = lines.length;
    // The em box of the first line spans emC +- 0.5 above its baseline, that of the last line likewise.
    const middle = emC.p - (Math.max(0, n - 1) * pitch) / 2;
    for (const p of pieces) p.y -= middle;
    return { pieces, width: maxWidth, height: Math.max(0, n - 1) * pitch + 1 };
}
