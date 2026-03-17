const fs = require('fs');

function extractTTFFromTTC(ttcBuffer, fontIndex = 0) {
    const dataView = new DataView(ttcBuffer);
    
    // Check magic bytes
    if (dataView.getUint32(0, false) !== 0x74746366) { // 'ttcf'
        throw new Error("Not a TTC file");
    }
    
    const numFonts = dataView.getUint32(8, false);
    if (fontIndex >= numFonts) {
        throw new Error("Font index out of bounds");
    }
    
    // Read the offset to the specific font's TableDirectory
    const offsetTableOffset = dataView.getUint32(12 + (fontIndex * 4), false);
    
    // SFNT header is 12 bytes
    const sfntVersion = dataView.getUint32(offsetTableOffset, false);
    const numTables = dataView.getUint16(offsetTableOffset + 4, false);
    const searchRange = dataView.getUint16(offsetTableOffset + 6, false);
    const entrySelector = dataView.getUint16(offsetTableOffset + 8, false);
    const rangeShift = dataView.getUint16(offsetTableOffset + 10, false);
    
    // Read all table records
    const tables = [];
    let tableDirOffset = offsetTableOffset + 12;
    for (let i = 0; i < numTables; i++) {
        const tag = dataView.getUint32(tableDirOffset, false);
        const checkSum = dataView.getUint32(tableDirOffset + 4, false);
        const offset = dataView.getUint32(tableDirOffset + 8, false);
        const length = dataView.getUint32(tableDirOffset + 12, false);
        tables.push({ tag, checkSum, offset, length });
        tableDirOffset += 16;
    }
    
    // Calculate new total size
    let totalSize = 12 + (numTables * 16);
    for (const table of tables) {
        totalSize += Math.ceil(table.length / 4) * 4; // 4-byte aligned
    }
    
    // Create new buffer
    const ttfBuffer = new ArrayBuffer(totalSize);
    const ttfView = new DataView(ttfBuffer);
    const ttfUint8 = new Uint8Array(ttfBuffer);
    const srcUint8 = new Uint8Array(ttcBuffer);
    
    // Write SFNT header
    ttfView.setUint32(0, sfntVersion, false);
    ttfView.setUint16(4, numTables, false);
    ttfView.setUint16(6, searchRange, false);
    ttfView.setUint16(8, entrySelector, false);
    ttfView.setUint16(10, rangeShift, false);
    
    let currentWriteOffset = 12 + (numTables * 16);
    let currentDirOffset = 12;
    
    for (const table of tables) {
        // Write directory entry
        ttfView.setUint32(currentDirOffset, table.tag, false);
        ttfView.setUint32(currentDirOffset + 4, table.checkSum, false);
        ttfView.setUint32(currentDirOffset + 8, currentWriteOffset, false);
        ttfView.setUint32(currentDirOffset + 12, table.length, false);
        currentDirOffset += 16;
        
        // Copy table data
        ttfUint8.set(srcUint8.subarray(table.offset, table.offset + table.length), currentWriteOffset);
        
        // Advance write offset with 4-byte padding
        currentWriteOffset += Math.ceil(table.length / 4) * 4;
    }
    
    return ttfBuffer;
}

try {
    const buffer = fs.readFileSync('/System/Library/Fonts/Supplemental/AmericanTypewriter.ttc').buffer;
    const extractedBuffer = extractTTFFromTTC(buffer, 0);
    console.log("Successfully extracted TTF! Buffer size:", extractedBuffer.byteLength);
    
    // Test if opentype can parse it
    const opentype = require('opentype.js');
    const font = opentype.parse(extractedBuffer);
    console.log("Opentype parsed successfully. Font name:", font.names.fontFamily.en);
} catch(e) {
    console.error(e);
}
