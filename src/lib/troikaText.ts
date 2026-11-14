import type { Material, Object3D } from 'three';

/**
 * What the app reads from a troika text mesh (troika-three-text ships no types). Only the members that are used are listed.
 */
export type TroikaText = Object3D & {
    text: string;
    fillOpacity: number;
    material: Material | Material[];
    sync(callback?: () => void): void;
    /** Troika's own flags: a sync is wanted / running. */
    _needsSync: boolean;
    _isSyncing: boolean;
    /** Set once a sync has completed. */
    textRenderInfo?: {
        sdfTexture: { image: { width: number; height: number } };
        glyphAtlasIndices: ArrayLike<number>;
        /** [minX, minY, maxX, maxY] of the glyphs that are drawn, in the mesh's local units. */
        visibleBounds?: number[];
    };
    addEventListener(type: 'synccomplete', listener: () => void): void;
    removeEventListener(type: 'synccomplete', listener: () => void): void;
};

export function isTroikaText(o: Object3D): o is TroikaText {
    return typeof (o as Partial<TroikaText>).sync === 'function';
}
