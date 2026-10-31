const fs = require('fs');
const fontkit = require('fontkit');

try {
    const buffer = fs.readFileSync('/System/Library/Fonts/Supplemental/AmericanTypewriter.ttc');
    
    // Check magic bytes
    const isTTC = buffer.length >= 4 && 
                  buffer[0] === 0x74 && buffer[1] === 0x74 && 
                  buffer[2] === 0x63 && buffer[3] === 0x66;
                  
    console.log('Is TTC by magic bytes?', isTTC);
    
    if (isTTC) {
        const collection = fontkit.create(buffer);
        console.log('Collection fonts count:', collection.fonts.length);
        const firstFont = collection.fonts[0];
        console.log('First font name:', firstFont.fullName);
        console.log('Extracted stream buffer size:', firstFont.stream.buffer.length);
    }
} catch(e) {
    console.error(e);
}
