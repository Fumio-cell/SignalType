/**
 * Colour tokens for code that cannot use a CSS class (three.js materials). The values live in
 * src/styles/signal.css; this reads them, so no colour literal exists anywhere else in src/.
 */
export function cssColor(token: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}
