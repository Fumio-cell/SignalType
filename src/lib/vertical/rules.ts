/**
 * Vertical-writing rules, kept as tables in our own code. Neither troika (2D) nor Text3D knows a
 * writing direction, and the font's own vertical forms (the OpenType vert / vrt2 features) are not
 * read by either of them or by src/lib/fonts/subset.ts. Everything below is therefore decided here.
 */

/** Characters whose horizontal glyph is turned 90 degrees clockwise about the cell centre. */
const ROTATED = new Set(
    Array.from(
        [
            // long vowel mark, wave dashes, minus, dashes
            'ー〜～−–—―‐',
            // brackets
            '（）()〔〕［］[]｛｝{}〈〉《》「」『』【】〖〗',
            // quotation marks
            '‘’“”',
            // leaders
            '…‥',
            // signs
            '＝≒≠＜＞≦≧',
        ].join(''),
    ),
);

/** Punctuation that keeps its shape and moves from the lower left to the upper right of its cell. */
const PUNCTUATION = new Set(Array.from('。、，．'));

/** Small kana and the full-size kana they are drawn like. */
const SMALL_TO_FULL: Record<string, string> = {
    ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お', っ: 'つ', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ゎ: 'わ', ゕ: 'か', ゖ: 'け',
    ァ: 'ア', ィ: 'イ', ゥ: 'ウ', ェ: 'エ', ォ: 'オ', ッ: 'ツ', ャ: 'ヤ', ュ: 'ユ', ョ: 'ヨ', ヮ: 'ワ', ヵ: 'カ', ヶ: 'ケ',
};

export function isRotatedChar(ch: string): boolean {
    return ROTATED.has(ch);
}

export function isShiftedPunctuation(ch: string): boolean {
    return PUNCTUATION.has(ch);
}

/** The full-size kana that a small kana is aligned to, or undefined for any other character. */
export function fullSizeOf(ch: string): string | undefined {
    return SMALL_TO_FULL[ch];
}

/** Half-width digits and Latin letters: the characters that form runs (tate-chu-yoko / rotated runs). */
export function isAsciiAlnum(ch: string): boolean {
    return /^[0-9A-Za-z]$/.test(ch);
}

export function isAscii(ch: string): boolean {
    const cp = ch.codePointAt(0)!;
    return cp < 0x80;
}

/** Every character the layout asks the font for besides the typed ones (the kana reference glyphs). */
export function referenceChars(text: string): string[] {
    const out = new Set<string>();
    for (const ch of text) {
        const full = SMALL_TO_FULL[ch];
        if (full) out.add(full);
    }
    return [...out];
}
