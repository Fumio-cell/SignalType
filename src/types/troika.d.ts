// troika-three-text ships no type declarations; only what src/lib/export/atlas.ts uses is declared.
declare module 'troika-three-text' {
    export function preloadFont(
        options: { font: string; characters: string | string[]; sdfGlyphSize?: number },
        callback: (info: unknown) => void,
    ): void;
}
