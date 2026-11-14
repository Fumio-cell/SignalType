import { useEffect } from 'react';
import { flushSync as domFlushSync } from 'react-dom';
import { advance, flushSync, invalidate, useStore } from '@react-three/fiber';
import * as THREE from 'three';
import type { ShaderMaterial } from 'three';
import { useAppStore } from '@/store/appStore';
import { getComposer, setExportStage, useExportMode, type ExportStage } from '@/lib/export/stage';
import { beginDeterministic, endDeterministic, setFrame, withSeededRandom } from '@/lib/export/frameClock';
import { atlasSignature, preloadExportAtlas } from '@/lib/export/atlas';
import { isTroikaText, type TroikaText } from '@/lib/troikaText';

/**
 * Lets the export render at an exact pixel size, independent of the window and of DPR.
 *
 * Why resize the live renderer instead of drawing into a separate WebGLRenderTarget:
 * the scene, the camera and the post-processing chain (glitch, chromatic aberration, noise)
 * already live in this renderer, and EffectComposer always finishes on the default framebuffer.
 * Resizing it for the duration of the export reuses all of that, so the exported frames are
 * exactly what the stage draws.
 *
 * The renderer is resized directly, not through the R3F store: the Canvas owns the store size
 * (it follows the container) and would overwrite an export size set there. The container never
 * changes size, so the Canvas never intervenes. The canvas CSS size stays as it is and
 * object-fit: contain shows the export frame letterboxed inside the stage.
 */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export function ExportBridge() {
    const store = useStore();

    useEffect(() => {
        let saved: { frameloop: 'always' | 'demand' | 'never'; dpr: number; objectFit: string } | null = null;

        let target = { w: 0, h: 0 };

        // Size the renderer, the composer's buffers and the camera for the export frame.
        const applyTarget = () => {
            const { gl } = store.getState();
            gl.setPixelRatio(1);
            const composer = getComposer();
            if (composer) composer.setSize(target.w, target.h, false);
            else gl.setSize(target.w, target.h, false);
            setAspect(target.w, target.h);
        };

        const setAspect = (w: number, h: number) => {
            const camera = store.getState().camera;
            if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
                const cam = camera as THREE.PerspectiveCamera;
                cam.aspect = w / h;
                cam.updateProjectionMatrix();
            }
        };

        // Text laid out by troika (2D mode) is typeset asynchronously in a worker; wait until it is
        // done so the frame never shows the previous line. Troika only calls a sync() callback when
        // it has work to do, so wait for its 'synccomplete' event instead and only while it is busy.
        const waitForTroika = async (o: TroikaText) => {
            for (let i = 0; i < 5; i++) {
                if (o._needsSync) o.sync();
                if (!o._isSyncing) return;
                await new Promise<void>((resolve) => {
                    const done = () => {
                        clearTimeout(timer);
                        o.removeEventListener('synccomplete', done);
                        resolve();
                    };
                    const timer = setTimeout(done, 5000);
                    o.addEventListener('synccomplete', done);
                });
            }
        };
        const settleText = async () => {
            const pending: Promise<void>[] = [];
            store.getState().scene.traverse((o) => {
                if (isTroikaText(o) && 'text' in o) pending.push(waitForTroika(o));
            });
            if (pending.length) await Promise.all(pending);
        };

        // The export may start only once the glyph atlas has stopped changing: the same signature on two checks in a row.
        const settleAtlas = async () => {
            let previous = '';
            let stable = 0;
            for (let i = 0; i < 40 && stable < 2; i++) {
                await settleText();
                await tick();
                const now = atlasSignature(store.getState().scene);
                stable = i > 0 && now === previous ? stable + 1 : 0;
                previous = now;
            }
        };

        const stage: ExportStage = {
            async begin(width, height) {
                const s = store.getState();
                saved = {
                    frameloop: s.frameloop,
                    dpr: s.gl.getPixelRatio(),
                    objectFit: s.gl.domElement.style.objectFit,
                };
                beginDeterministic();
                // 2D text: the export's own glyph atlas, filled with every glyph of the text in a fixed order.
                await preloadExportAtlas();
                // The Canvas props say 'never' / dpr 1 while exporting, so it cannot undo what follows.
                domFlushSync(() => useExportMode.setState({ active: true }));
                s.setFrameloop('never');
                // Flipping the mode re-renders the Canvas, which re-applies its measured size to the
                // renderer once its effects have run. Let that settle before sizing for the export.
                await tick();
                await tick();
                target = { w: width, h: height };
                applyTarget();
                store.getState().gl.domElement.style.objectFit = 'contain';
                await settleAtlas();
            },

            async renderFrame(frame, fps) {
                const seconds = frame / fps;
                setFrame(frame, seconds);
                flushSync(() => useAppStore.getState().setCurrentTime(seconds));
                await settleText();
                const s = store.getState();
                // Anything that re-measured the stage meanwhile (a Canvas re-render) is undone here.
                if (s.gl.domElement.width !== target.w || s.gl.domElement.height !== target.h) applyTarget();
                // The effect passes keep a clock of their own (the grain pattern moves with it) that runs on from the preview and
                // starts again whenever the composer rebuilds its passes. Set it from the frame number, so it is the same on every export.
                for (const pass of getComposer()?.passes ?? []) {
                    const clock = (pass.fullscreenMaterial as ShaderMaterial | undefined)?.uniforms?.time;
                    if (clock) clock.value = seconds;
                }
                withSeededRandom(() => advance(seconds, true, s));
                return s.gl.domElement;
            },

            async end() {
                endDeterministic();
                if (!saved) return;
                const prev = saved;
                saved = null;
                domFlushSync(() => useExportMode.setState({ active: false }));
                await tick();
                await tick();
                const s = store.getState();
                s.gl.setPixelRatio(prev.dpr);
                const composer = getComposer();
                if (composer) composer.setSize(s.size.width, s.size.height, true);
                else s.gl.setSize(s.size.width, s.size.height, true);
                setAspect(s.size.width, s.size.height);
                s.gl.domElement.style.objectFit = prev.objectFit;
                s.setFrameloop(prev.frameloop);
                invalidate();
            },
        };

        setExportStage(stage);
        return () => setExportStage(null);
    }, [store]);

    return null;
}
