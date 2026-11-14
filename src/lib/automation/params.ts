import { RGB_SPLIT_MAX } from '@/lib/look/limits';
import { MAX_COLUMN_PITCH, MIN_COLUMN_PITCH } from '@/lib/vertical/layout';
import type { AutomationParamId } from './types';

/** Where each automatable knob lives in the settings, and the range it is kept to. */
export interface AutomationParam {
    id: AutomationParamId;
    label: string;
    target: 'render' | 'glitch';
    key: string;
    min: number;
    max: number;
}

export const AUTOMATION_PARAMS: AutomationParam[] = [
    { id: 'ink', label: 'Ink bleed', target: 'render', key: 'ink', min: 0, max: 1 },
    { id: 'size', label: 'Size', target: 'render', key: 'fontSize', min: 0.1, max: 5 },
    { id: 'columnPitch', label: 'Column pitch', target: 'render', key: 'columnPitch', min: MIN_COLUMN_PITCH, max: MAX_COLUMN_PITCH },
    { id: 'burstGain', label: 'Audio burst gain', target: 'glitch', key: 'burstGain', min: 0, max: 3 },
    { id: 'intensity', label: 'Base intensity', target: 'glitch', key: 'intensityBase', min: 0, max: 0.5 },
    { id: 'rgbSplit', label: 'RGB split spread', target: 'glitch', key: 'rgbSplit', min: 0, max: RGB_SPLIT_MAX },
    { id: 'shake', label: 'Vertical shake', target: 'glitch', key: 'verticalShake', min: 0, max: 1 },
    { id: 'float', label: 'Ambient float', target: 'glitch', key: 'baseFloat', min: 0, max: 0.5 },
];

export const PARAM_BY_ID = Object.fromEntries(AUTOMATION_PARAMS.map((p) => [p.id, p])) as Record<AutomationParamId, AutomationParam>;
