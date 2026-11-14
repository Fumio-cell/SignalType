import { preloadFont } from 'troika-three-text';
import type { Object3D } from 'three';
import { useAppStore } from '@/store/appStore';
import { isTroikaText } from '@/lib/troikaText';

/**
 * 2D text (troika) draws from an SDF atlas: one texture per glyph size, shared by every text and filled
 * lazily, a glyph taking the next free slot the first time any text needs it. Which slot a glyph gets, and
 * how big the texture is, changes the pixels at the edge of a stroke by a few levels. So the slot order has to
 * be a function of the project, not of what happened to be on screen before.
 *
 * The preview draws at SDF_PREVIEW. An export draws at its own size, SDF_EXPORT: a separate atlas that is
 * empty when the first export of a session starts. exportBegin() fills it with every glyph of the whole text
 * (all lines, both fonts), sorted by font and code point, before the first frame.
 */
export const SDF_PREVIEW = 64;
export const SDF_EXPORT = 128;

/** Every character of the text that is drawn, per font file, in a fixed order. */
function glyphsByFont(): { font: string; characters: string[] }[] {
    const render = useAppStore.getState().settings.render;
    const faces = render.faces2D;
    if (!faces) return [];
    const own = new Set<string>();
    const other = new Set<string>();
    for (const ch of render.text) {
        if (/\s/.test(ch)) continue;
        if (ch in faces.primary.data.glyphs) own.add(ch);
        else if (faces.fallback && ch in faces.fallback.data.glyphs) other.add(ch);
    }
    const byCodePoint = (a: string, b: string) => a.codePointAt(0)! - b.codePointAt(0)!;
    const out = [{ font: faces.primary.url, characters: [...own].sort(byCodePoint) }];
    if (faces.fallback) out.push({ font: faces.fallback.url, characters: [...other].sort(byCodePoint) });
    return out.filter((g) => g.characters.length > 0);
}

/** Put the glyphs of the whole text into the export atlas, in a fixed order. 3D text has no atlas. */
export async function preloadExportAtlas(): Promise<void> {
    if (useAppStore.getState().settings.render.textMode !== '2D') return;
    for (const { font, characters } of glyphsByFont()) {
        await new Promise<void>((resolve) => preloadFont({ font, characters, sdfGlyphSize: SDF_EXPORT }, () => resolve()));
    }
}

/** What the atlas looks like to the texts drawn from it: texture size and the slot of every glyph. */
export function atlasSignature(scene: Object3D): string {
    const parts: string[] = [];
    scene.traverse((o) => {
        const info = isTroikaText(o) ? o.textRenderInfo : undefined;
        if (isTroikaText(o) && info) {
            const img = info.sdfTexture.image;
            parts.push(`${img.width}x${img.height}|${o.text}|${Array.from(info.glyphAtlasIndices).join(',')}`);
        }
    });
    return parts.join(';');
}
