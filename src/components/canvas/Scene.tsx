import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Text3D, Center, useMatcapTexture } from '@react-three/drei';
import { useAppStore } from '@/store/appStore';
import { useAudioFeatures } from '@/lib/audio/useAudioFeatures';
import * as THREE from 'three';

export function GlitchTextScene() {
    const render = useAppStore(state => state.settings.render);
    const currentLineIndex = useAppStore(state => state.currentLineIndex);
    const lastSequenceTime = useAppStore(state => state.lastSequenceTime);
    const textRef = useRef<THREE.Mesh>(null);
    const features = useAudioFeatures();
    const glitch = useAppStore(state => state.settings.glitch);

    // Use a stylized matcap for interesting reflections if selected
    const [matcap] = useMatcapTexture("7877EE_D87FC5_75D9C7_1C78C0", 256);

    // Animate the text slightly based on time (independent of audio for base motion)
    // Also handle appearance/disappearance duration based on sequence beats
    useFrame((state) => {
        if (textRef.current) {
            const t = state.clock.getElapsedTime();

            // Calculate random vertical shake based on setting and audio onset
            const shakeAmt = glitch.verticalShake * (1.0 + features.onset * 2.0);
            const shakeY = (Math.random() - 0.5) * shakeAmt;

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

    const displayText = useMemo(() => {
        if (!render.sequenceMode || !render.text) return render.text;

        const lines = render.text.split('\n').filter(line => line.trim().length > 0);
        if (lines.length === 0) return '';

        // Wrap around if index is out of bounds
        const safeIndex = currentLineIndex % lines.length;
        return lines[safeIndex] || '';
    }, [render.text, render.sequenceMode, currentLineIndex]);

    const materialContent = useMemo(() => {
        switch (render.materialMode) {
            case 'matcap':
                return <meshMatcapMaterial matcap={matcap} transparent={true} opacity={1} />;
            case 'metallic':
                return <meshStandardMaterial color="#ffffff" metalness={0.8} roughness={0.2} transparent={true} opacity={1} />;
            case 'standard':
            default:
                return <meshStandardMaterial color="#eeeeee" transparent={true} opacity={1} />;
        }
    }, [render.materialMode, matcap]);

    return (
        <group>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1.5} />
            <spotLight position={[-10, 10, 10]} angle={0.3} penumbra={1} intensity={2} color="#4ade80" />

            <Center>
                {render.textMode === '2D' ? (
                    <Text
                        ref={textRef as any}
                        font={render.customFontUrl || undefined}
                        fontSize={render.fontSize}
                        anchorX="center"
                        anchorY="middle"
                        textAlign="center"
                    >
                        {displayText}
                        {materialContent}
                    </Text>
                ) : (
                    <Text3D
                        ref={textRef as any}
                        font={render.customFontData || render.font}
                        size={render.fontSize}
                        height={render.bevelEnabled ? 0.2 : 0.05}
                        curveSegments={12}
                        bevelEnabled={render.bevelEnabled}
                        bevelThickness={0.02}
                        bevelSize={0.02}
                        bevelOffset={0}
                        bevelSegments={5}
                    >
                        {displayText}
                        {materialContent}
                    </Text3D>
                )}
            </Center>
        </group>
    );
}
