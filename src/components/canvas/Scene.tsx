import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Text3D, Center } from '@react-three/drei';
import { useAppStore } from '@/store/appStore';
import { useAudioFeatures } from '@/lib/audio/useAudioFeatures';
import * as THREE from 'three';
import { frameRandom, getExportTime, isExportActive } from '@/lib/export/frameClock';
import { layoutHorizontal, layoutVertical, type Drawable, type Layout, type Lookup } from '@/lib/vertical/layout';

// 2D text: troika downloads fallback fonts from cdn.jsdelivr.net for any glyph its font lacks. Nothing
// here ever hands it such a character: text is split between the chosen font and the bundled Zen Kaku
// Gothic New (src/lib/fontLoader.ts decides which font has which character), and what neither has is left out.

/** Text3D's size 1 is 1000 typeface units = 0.72 em, so one em is 100/72 of the size. */
const EM_PER_SIZE_3D = 100 / 72;

// drei's <Center cacheKey={centerKey}> measures its children only when its cacheKey changes. For 3D text the key has to
// follow what shapes the outline: the converted glyph data, the drawn text, the size and the extrusion.
const fontDataIds = new WeakMap<object, number>();
let nextFontDataId = 0;
function fontDataId(data: object | null): number {
    if (!data) return 0;
    let id = fontDataIds.get(data);
    if (id === undefined) fontDataIds.set(data, (id = ++nextFontDataId));
    return id;
}

export function GlitchTextScene() {
    const render = useAppStore(state => state.settings.render);
    const currentLineIndex = useAppStore(state => state.currentLineIndex);
    const lastSequenceTime = useAppStore(state => state.lastSequenceTime);
    // The float/shake animation moves this group, which sits outside <Center>: Center measures its
    // children's world transform, so animating the text itself would bake the animation phase of the
    // moment into the centering offset.
    const textRef = useRef<THREE.Group>(null);
    const features = useAudioFeatures();
    const glitch = useAppStore(state => state.settings.glitch);

    // Animate the text slightly based on time (independent of audio for base motion)
    // Also handle appearance/disappearance duration based on sequence beats
    useFrame((state) => {
        if (textRef.current) {
            // Export: time comes from the frame number; preview: wall clock.
            const t = isExportActive() ? getExportTime() : state.clock.getElapsedTime();

            // Calculate random vertical shake based on setting and audio onset
            const shakeAmt = glitch.verticalShake * (1.0 + features.onset * 2.0);
            const shakeY = (frameRandom() - 0.5) * shakeAmt;

            // Subtle floating + shake, controlled by baseFloat
            textRef.current.position.y = (Math.sin(t * 1.5) * glitch.baseFloat) + shakeY;
            textRef.current.rotation.z = Math.sin(t * 0.5) * (glitch.baseFloat * 0.2);

            // Transition logic for appearance duration
            const currentTime = useAppStore.getState().currentTime;

            let targetOpacity = 1;
            if (render.sequenceMode) {
                const timeSinceBeat = currentTime - lastSequenceTime;

                // Keep fully visible for the first 80% of the duration
                const visibleDuration = render.sequenceDuration * 0.8;

                if (timeSinceBeat >= render.sequenceDuration) {
                    targetOpacity = 0; // Next beat hasn't triggered yet, stay hidden
                } else if (timeSinceBeat >= visibleDuration) {
                    // Fade out during the last 20% of the duration
                    const fadeProgress = (timeSinceBeat - visibleDuration) / (render.sequenceDuration - visibleDuration);
                    targetOpacity = Math.max(0, 1 - fadeProgress);
                } else {
                    targetOpacity = 1; // Fully visible
                }
            }

            // Apply opacity without resetting needsUpdate constantly
            textRef.current.traverse((child: any) => {
                // For Text3D meshes
                if (child.isMesh && child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach((mat: THREE.Material) => {
                        mat.transparent = true;
                        // Use direct assignment for targetOpacity since it's already calculated smoothly over time
                        mat.opacity = targetOpacity;
                        // Needsupdate only if explicitly changing material types, usually changing opacity works without it
                    });
                }
                // For Troika Text (2D)
                if (child.textRenderInfo !== undefined || child.fillOpacity !== undefined) {
                    child.fillOpacity = targetOpacity;
                    if (child.material) {
                        child.material.opacity = targetOpacity;
                        child.material.transparent = true;
                    }
                }
            });
            textRef.current.scale.set(1, 1, 1); // Reset scale in case it was shrunk before
        }
    });

    // The faces this mode draws with: the chosen font and the one that stands in for what it lacks.
    const is2D = render.textMode === '2D';
    const faces = is2D ? render.faces2D : render.faces3D;
    const primary = faces?.primary ?? null;
    const fallback = faces?.fallback ?? null;

    // User Timing mark so a harness can tell when new font data reached the scene.
    useEffect(() => {
        performance.mark('font:committed');
    }, [render.faces2D, render.faces3D]);

    const displayText = useMemo(() => {
        if (!render.sequenceMode || !render.text) return render.text;

        const lines = render.text.split('\n').filter(line => line.trim().length > 0);
        if (lines.length === 0) return '';

        // Wrap around if index is out of bounds
        const safeIndex = currentLineIndex % lines.length;
        return lines[safeIndex] || '';
    }, [render.text, render.sequenceMode, currentLineIndex]);

    // A character is drawn with the chosen font if the converted glyphs of that font hold it, else with
    // the fallback font, else not at all. The converted glyphs follow the text a moment after a keystroke,
    // and without this filter three logs an error per missing character and troika fetches a fallback
    // font from a CDN, which would send the characters off this machine.
    const lookup = useMemo<Lookup>(() => {
        const own = primary?.data;
        const other = fallback?.data;
        return (ch: string): Drawable | null => {
            if (own && ch in own.glyphs) return { slot: 'p', m: own.st.glyphs[ch] };
            if (other && ch in other.glyphs) return { slot: 'f', m: other.st.glyphs[ch] };
            return null;
        };
    }, [primary, fallback]);

    // One Text / Text3D for the whole text when it is horizontal and one font draws all of it (the
    // plain case). Anything else is drawn piece by piece from a layout.
    const needsFallback = useMemo(() => {
        if (!primary || !fallback) return false;
        return Array.from(displayText).some((ch) => ch !== '\n' && !(ch in primary.data.glyphs) && ch in fallback.data.glyphs);
    }, [displayText, primary, fallback]);
    const pieced = render.vertical || needsFallback;

    const shownText = useMemo(() => {
        if (!primary) return '';
        return Array.from(displayText).filter((ch) => ch === '\n' || ch in primary.data.glyphs).join('');
    }, [displayText, primary]);

    const layout = useMemo<Layout | null>(() => {
        if (!pieced || !primary) return null;
        const lines = displayText.split('\n');
        // A line break at the very end (the user is about to type the next line) is not a blank line yet.
        while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
        const emC = { p: primary.data.st.emCenter, f: fallback?.data.st.emCenter ?? primary.data.st.emCenter };
        const { pitch2D, pitch3D } = primary.data.st;
        // Horizontal lines keep the pitch this mode already uses. Columns of vertical text use the larger of
        // the two existing pitches, and never less than one em, so 2D and 3D set the same columns.
        return render.vertical
            ? layoutVertical(lines, lookup, emC, Math.max(1, pitch2D, pitch3D))
            : layoutHorizontal(lines, lookup, emC, is2D ? pitch2D : pitch3D, is2D ? 'center' : 'left');
    }, [pieced, primary, fallback, displayText, lookup, render.vertical, is2D]);

    const centerKey = is2D
        ? 'flat'
        : `${fontDataId(primary?.data ?? null)}|${shownText}|${render.fontSize}|${render.bevelEnabled}`;

    const extrusion = render.bevelEnabled ? 0.2 : 0.05;
    const emWorld = is2D ? render.fontSize : render.fontSize * EM_PER_SIZE_3D;

    const materialContent = useMemo(() => {
        switch (render.materialMode) {
            case 'metallic':
                return <meshStandardMaterial color="#ffffff" metalness={0.8} roughness={0.2} transparent={true} opacity={1} />;
            case 'standard':
            default:
                return <meshStandardMaterial color="#eeeeee" transparent={true} opacity={1} />;
        }
    }, [render.materialMode]);

    return (
        <group>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1.5} />
            <spotLight position={[-10, 10, 10]} angle={0.3} penumbra={1} intensity={2} color="#4ade80" />

            <group ref={textRef}>
                {layout && primary ? (
                    // The 3D block is centred in depth like <Center> does for plain text.
                    <group position={[0, 0, is2D ? 0 : -extrusion / 2]}>
                        {layout.pieces.map((p, i) => {
                            const face = p.slot === 'p' ? primary : fallback;
                            if (!face) return null;
                            return (
                                <group
                                    key={`${i}|${p.slot}|${p.text}`}
                                    position={[p.x * emWorld, p.y * emWorld, 0]}
                                    rotation={[0, 0, p.rot]}
                                    scale={[p.scale, p.scale, 1]}
                                >
                                    <group position={[p.ox * emWorld, p.oy * emWorld, 0]}>
                                        {is2D ? (
                                            <Text font={face.url} fontSize={emWorld} anchorX={0} anchorY="bottom-baseline">
                                                {p.text}
                                                {materialContent}
                                            </Text>
                                        ) : (
                                            <Text3D
                                                font={face.data as any}
                                                size={render.fontSize}
                                                height={extrusion}
                                                curveSegments={12}
                                                bevelEnabled={render.bevelEnabled}
                                                bevelThickness={0.02}
                                                bevelSize={0.02}
                                                bevelOffset={0}
                                                bevelSegments={5}
                                            >
                                                {p.text}
                                                {materialContent}
                                            </Text3D>
                                        )}
                                    </group>
                                </group>
                            );
                        })}
                    </group>
                ) : (
                    <Center cacheKey={centerKey} disable={is2D}>
                        {is2D ? (
                            primary && (
                                <Text
                                    font={primary.url}
                                    fontSize={render.fontSize}
                                    anchorX="center"
                                    anchorY="middle"
                                    textAlign="center"
                                >
                                    {shownText}
                                    {materialContent}
                                </Text>
                            )
                        ) : (
                            primary && (
                                <Text3D
                                    font={primary.data as any}
                                    size={render.fontSize}
                                    height={extrusion}
                                    curveSegments={12}
                                    bevelEnabled={render.bevelEnabled}
                                    bevelThickness={0.02}
                                    bevelSize={0.02}
                                    bevelOffset={0}
                                    bevelSegments={5}
                                >
                                    {shownText}
                                    {materialContent}
                                </Text3D>
                            )
                        )}
                    </Center>
                )}
            </group>
        </group>
    );
}
