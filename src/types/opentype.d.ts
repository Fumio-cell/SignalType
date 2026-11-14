// three ships its own copy of opentype.js (the one TTFLoader reads fonts with) and no declaration for it. The Font
// type comes from @types/opentype.js; the runtime is three's copy, so opentype.js itself is not a dependency.
declare module 'three/examples/jsm/libs/opentype.module.js' {
    import type { Font } from 'opentype.js';
    export function parse(buffer: ArrayBuffer, options?: { lowMemory?: boolean }): Font;
}
