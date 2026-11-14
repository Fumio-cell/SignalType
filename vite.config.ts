import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'node:fs';

/**
 * Troika (the 2D text renderer) keeps its SDF glyph atlases in a module-private table with no way to empty it, and a
 * glyph's slot in the atlas changes the pixels at the edge of a stroke. For exports to give the same frames whatever
 * was on screen before, every export has to start from an empty atlas, so src/lib/export/atlas.ts calls
 * resetSDFAtlases(). Troika has no such function; this adds one to its source while it is bundled.
 *
 * The patch is written against troika-three-text 0.52.4 and package.json pins exactly that version. It fails the build,
 * loudly, if the version is not that one, if the line it hooks onto is not found exactly once, or if the source already
 * has the function: reproducibility would otherwise break without a word. When you upgrade troika, read its
 * TextBuilder section (`const atlases`), update ANCHOR and PATCHED_TROIKA_VERSION, and run the atlas test again
 * (~/signaltype-tools/st8-h3.mjs: 300 of 300 frames equal).
 */
export const PATCHED_TROIKA_VERSION = '0.52.4';
const ANCHOR = 'const atlases = Object.create(null);';
const RESET_FUNCTION =
    'export function resetSDFAtlases() { for (const key of Object.keys(atlases)) { try { atlases[key].sdfTexture.dispose(); } catch { /* already gone */ } delete atlases[key]; } }';

/** Add resetSDFAtlases() to troika's source. Throws if the source is not the one this patch was written for. */
export function patchTroikaSource(code: string, file: string, installedVersion: string): string {
    const fail = (why: string) => {
        throw new Error(
            `[troika-atlas-reset] ${why}\n` +
                `  file: ${file}\n` +
                `  This patch adds resetSDFAtlases() to troika-three-text ${PATCHED_TROIKA_VERSION}; src/lib/export/atlas.ts calls it at the start of every export. ` +
                `Without it exports no longer start from an empty glyph atlas and stop being reproducible. ` +
                `Update ANCHOR and PATCHED_TROIKA_VERSION in vite.config.ts for the new troika source.`,
        );
    };
    if (installedVersion !== PATCHED_TROIKA_VERSION) {
        fail(`installed troika-three-text is ${installedVersion}, the patch is for ${PATCHED_TROIKA_VERSION}.`);
    }
    if (code.includes('resetSDFAtlases')) fail('the source already contains resetSDFAtlases (already patched, or troika added its own).');
    const count = code.split(ANCHOR).length - 1;
    if (count !== 1) fail(`expected the line \`${ANCHOR}\` exactly once, found it ${count} times.`);
    return code.replace(ANCHOR, `${ANCHOR}\n${RESET_FUNCTION}`);
}

const TROIKA_ESM = /troika-three-text[\\/]dist[\\/]troika-three-text\.esm\.js$/;
const installedTroikaVersion = (file: string) =>
    JSON.parse(fs.readFileSync(path.join(path.dirname(file), '..', 'package.json'), 'utf8')).version as string;

function troikaAtlasReset(): Plugin {
    let applied = false;
    let building = false;
    return {
        name: 'troika-atlas-reset',
        enforce: 'pre',
        configResolved(config) {
            building = config.command === 'build';
        },
        transform(code, id) {
            const file = id.split('?')[0];
            if (!TROIKA_ESM.test(file)) return null;
            applied = true;
            return patchTroikaSource(code, file, installedTroikaVersion(file));
        },
        buildEnd(error) {
            // A build that never met troika's source (resolved to another file, say) would ship without the function.
            if (building && !error && !applied) {
                throw new Error(
                    '[troika-atlas-reset] the build finished without ever transforming troika-three-text/dist/troika-three-text.esm.js. ' +
                        'resetSDFAtlases() would be missing and exports would stop being reproducible. Check how troika is resolved.',
                );
            }
        },
    };
}

export default defineConfig({
    plugins: [troikaAtlasReset(), react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    optimizeDeps: {
        // The dev server pre-bundles troika; the same patch has to be applied there.
        esbuildOptions: {
            plugins: [
                {
                    name: 'troika-atlas-reset',
                    setup(build) {
                        build.onLoad({ filter: TROIKA_ESM }, async (args) => ({
                            contents: patchTroikaSource(await fs.promises.readFile(args.path, 'utf8'), args.path, installedTroikaVersion(args.path)),
                            loader: 'js',
                        }));
                    },
                },
            ],
        },
    },
});
