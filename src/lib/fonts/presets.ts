import interBoldUrl from './Inter_Bold.json?url';
import poppinsRegUrl from './Poppins-Regular.ttf?url';
import poppinsBoldUrl from './Poppins-Bold.ttf?url';
import crimsonRegUrl from './CrimsonText-Regular.ttf?url';
import spaceMonoUrl from './SpaceMono-Regular.ttf?url';
import shipporiMinchoUrl from './ShipporiMincho-Regular.ttf?url';
import zenKakuUrl from './ZenKakuGothicNew-Regular.ttf?url';

export interface PresetFont {
    label: string;
    url: string;
    /** false: a ready-made typeface JSON (Inter Bold, Latin only). true: a TTF converted by the font worker. */
    isTTF: boolean;
}

export const PRESET_FONTS: PresetFont[] = [
    { label: 'Inter Bold (3D Only)', url: interBoldUrl, isTTF: false },
    { label: 'Poppins Regular (2D/3D)', url: poppinsRegUrl, isTTF: true },
    { label: 'Poppins Bold (2D/3D)', url: poppinsBoldUrl, isTTF: true },
    { label: 'Crimson Text (Serif)', url: crimsonRegUrl, isTTF: true },
    { label: 'Space Mono (Tech)', url: spaceMonoUrl, isTTF: true },
    { label: 'Zen Kaku Gothic (Japanese sans)', url: zenKakuUrl, isTTF: true },
    { label: 'Shippori Mincho (Japanese serif)', url: shipporiMinchoUrl, isTTF: true },
];

/** Covers Latin and Japanese, so 3D and 2D both draw any text the user types. */
export const DEFAULT_FONT: PresetFont = PRESET_FONTS.find((p) => p.url === zenKakuUrl)!;

/** The default typeface of the INK look. */
export const INK_FONT: PresetFont = PRESET_FONTS.find((p) => p.url === shipporiMinchoUrl)!;
