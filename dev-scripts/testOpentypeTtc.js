import * as opentype from 'opentype.js';
import fs from 'fs';

try {
    const buffer = fs.readFileSync('/System/Library/Fonts/Supplemental/AmericanTypewriter.ttc');
    const arrayBuffer = new Uint8Array(buffer).buffer;

    const font = opentype.parse(arrayBuffer, { fontIndex: 0 });
    console.log('Successfully parsed TTC with opentype.js!');
    console.log('Font name:', font.names.fontFamily.en);
} catch (e) {
    console.error('Opentype error:', e);
}
