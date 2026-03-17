import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';

/**
 * Extracts the first TTF font from a TrueType Collection (TTC/dfont) ArrayBuffer.
 */
function extractTTFFromTTC(ttcBuffer: ArrayBuffer, fontIndex: number = 0): ArrayBuffer {
    const dataView = new DataView(ttcBuffer);

    // Check magic bytes for TTC
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

    // Calculate new total size for the extracted TTF
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

/**
 * Convert an ArrayBuffer of a TTF/OTF/TTC file to a parsed JSON font object.
 * Uses a custom extractor for TrueType Collections (.ttc/.dfont)
 * and official Three.js TTFLoader for the final conversion.
 * Returning the raw parsed object instead of `new Font()` prevents @react-three/drei's 
 * Text3D from double-wrapping the Font object and losing the boundingBox reference.
 */
export async function loadCustomFont(arrayBuffer: ArrayBuffer, fileName: string = ''): Promise<any> {
    return new Promise((resolve, reject) => {
        try {
            let workingBuffer = arrayBuffer;

            try {
                // Determine format based on magic bytes 
                // 'ttcf' magic bytes at start indicate a TrueType Collection
                if (arrayBuffer.byteLength >= 4) {
                    const dataView = new DataView(arrayBuffer);
                    const isTTC = dataView.getUint32(0, false) === 0x74746366;
                    const isDfont = fileName.toLowerCase().endsWith('.dfont');

                    if (isTTC || isDfont) {
                        workingBuffer = extractTTFFromTTC(arrayBuffer, 0);
                        console.log("Successfully extracted TTF from TTC/dfont collection based on magic bytes");
                    }
                }
            } catch (extractorError) {
                console.warn("Native TTC extraction skipped or failed:", extractorError);
            }

            const loader = new TTFLoader();
            const parsedData = loader.parse(workingBuffer);
            if (!parsedData) {
                throw new Error("Failed to parse font data.");
            }

            // NOTE: @react-three/drei's Text3D expects the bounding box to be explicitly defined.
            // Some fonts parsed by TTFLoader might have missing boundingBox values.
            // We manually ensure boundingBox is properly set to prevent runtime crashes.
            if (parsedData.boundingBox) {
                parsedData.boundingBox.xMin = parsedData.boundingBox.xMin ?? 0;
                parsedData.boundingBox.xMax = parsedData.boundingBox.xMax ?? 1000;
                parsedData.boundingBox.yMin = parsedData.boundingBox.yMin ?? 0;
                parsedData.boundingBox.yMax = parsedData.boundingBox.yMax ?? 1000;
            } else {
                parsedData.boundingBox = {
                    xMin: 0, xMax: 1000, yMin: 0, yMax: 1000
                };
            }

            resolve(parsedData); // Return raw JSON instead of new Font(parsedData)
        } catch (error) {
            console.error("Font parsing failed:", error);
            reject(error);
        }
    });
}
