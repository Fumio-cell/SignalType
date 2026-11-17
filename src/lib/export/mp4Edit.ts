/**
 * Edit list for the audio track of a file written by mp4-muxer.
 *
 * An AAC encoder emits `priming` samples of lead-in before the first real sample, so without a correction the sound
 * arrives that much late (about 44 ms) against the picture. The fix every player honours is an edit list on the audio
 * track that starts the track `priming` samples into its media. mp4-muxer cannot write one, so it is inserted into the
 * finished file: the moov box grows, and the chunk offsets (which point into the mdat behind it) move with it.
 */

interface Box {
    type: string;
    start: number;
    header: number;
    end: number;
}

const fourcc = (v: DataView, at: number) => String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));

function boxesIn(v: DataView, start: number, end: number): Box[] {
    const found: Box[] = [];
    let at = start;
    while (at + 8 <= end) {
        let size = v.getUint32(at);
        let header = 8;
        if (size === 1) {
            size = Number(v.getBigUint64(at + 8));
            header = 16;
        } else if (size === 0) {
            size = end - at;
        }
        if (size < header || at + size > end) break;
        found.push({ type: fourcc(v, at + 4), start: at, header, end: at + size });
        at += size;
    }
    return found;
}

const child = (v: DataView, parent: Box, type: string): Box | undefined =>
    boxesIn(v, parent.start + parent.header, parent.end).find((b) => b.type === type);

/**
 * Returns `file` with an edit list on its audio track that skips `priming` samples and ends the track after
 * `seconds`. The durations in the track and movie headers are brought in line. `file` is not changed.
 */
export function addAudioEditList(file: Uint8Array, priming: number, seconds: number): Uint8Array<ArrayBuffer> {
    const v = new DataView(file.buffer, file.byteOffset, file.byteLength);
    const top = boxesIn(v, 0, file.byteLength);
    const moov = top.find((b) => b.type === 'moov');
    const mdat = top.find((b) => b.type === 'mdat');
    if (!moov || !mdat || mdat.start < moov.end || moov.header !== 8) throw new Error('Unexpected MP4 layout.');

    const traks = boxesIn(v, moov.start + moov.header, moov.end).filter((b) => b.type === 'trak');
    const audio = traks.find((t) => {
        const hdlr = child(v, child(v, t, 'mdia')!, 'hdlr');
        return hdlr !== undefined && fourcc(v, hdlr.start + hdlr.header + 8) === 'soun';
    });
    const tkhd = audio && child(v, audio, 'tkhd');
    const mvhd = child(v, moov, 'mvhd');
    if (!audio || !tkhd || !mvhd || audio.header !== 8) throw new Error('The MP4 has no audio track to edit.');
    if (v.getUint8(tkhd.start + tkhd.header) !== 0 || v.getUint8(mvhd.start + mvhd.header) !== 0) throw new Error('Unexpected MP4 header version.');

    const movieTimescale = v.getUint32(mvhd.start + mvhd.header + 12);
    const segment = Math.round(seconds * movieTimescale);

    // edts > elst, one entry: play the media from `priming` samples in, for `segment` movie ticks, at normal speed.
    const edts = new Uint8Array(36);
    const e = new DataView(edts.buffer);
    e.setUint32(0, 36);
    edts.set([0x65, 0x64, 0x74, 0x73], 4); // edts
    e.setUint32(8, 28);
    edts.set([0x65, 0x6c, 0x73, 0x74], 12); // elst
    e.setUint32(16, 0); // version 0, flags 0
    e.setUint32(20, 1); // one entry
    e.setUint32(24, segment);
    e.setInt32(28, priming); // the audio media's timescale is its sample rate, so this is samples
    e.setUint32(32, 0x00010000); // rate 1.0

    const at = tkhd.end;
    const out = new Uint8Array(file.byteLength + edts.byteLength);
    out.set(file.subarray(0, at));
    out.set(edts, at);
    out.set(file.subarray(at), at + edts.byteLength);
    const o = new DataView(out.buffer);
    const shift = (position: number) => (position >= at ? position + edts.byteLength : position);

    // The boxes that contain the new one grow; every chunk offset moves by the same amount.
    o.setUint32(moov.start, moov.end - moov.start + edts.byteLength);
    o.setUint32(audio.start, audio.end - audio.start + edts.byteLength);
    for (const trak of traks) {
        const stbl = child(v, child(v, child(v, trak, 'mdia')!, 'minf')!, 'stbl')!;
        for (const box of boxesIn(v, stbl.start + stbl.header, stbl.end)) {
            if (box.type !== 'stco' && box.type !== 'co64') continue;
            const wide = box.type === 'co64';
            const count = v.getUint32(box.start + box.header + 4);
            for (let i = 0; i < count; i++) {
                const position = shift(box.start + box.header + 8 + i * (wide ? 8 : 4));
                if (wide) o.setBigUint64(position, o.getBigUint64(position) + BigInt(edts.byteLength));
                else o.setUint32(position, o.getUint32(position) + edts.byteLength);
            }
        }
    }

    // The audio track now lasts `segment`; the movie lasts as long as its longest track.
    const durationAt = (t: Box) => shift(t.start) + t.header + 20;
    o.setUint32(durationAt(tkhd), segment);
    let movie = segment;
    for (const trak of traks) {
        const header = child(v, trak, 'tkhd')!;
        movie = Math.max(movie, o.getUint32(durationAt(header)));
    }
    o.setUint32(shift(mvhd.start) + mvhd.header + 16, movie);
    return out;
}
