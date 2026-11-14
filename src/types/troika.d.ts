// troika-three-text ships no type declarations; only what src/lib/export/atlas.ts uses is declared.
declare module 'troika-three-text' {
    /** Not in troika: added by the build (vite.config.ts), which fails if it cannot. Empties every SDF atlas. */
    export function resetSDFAtlases(): void;
    export function preloadFont(
        options: { font: string; characters: string | string[]; sdfGlyphSize?: number },
        callback: (info: unknown) => void,
    ): void;
}
