import { create } from 'zustand';
import type { AutomationData, AutomationParamId, AutomationPoint } from './types';

interface AutomationState {
    /** The recorded curves. */
    curves: AutomationData;
    /** Record is armed: while the track plays, moving an automatable knob records it. */
    armed: boolean;
    setArmed: (armed: boolean) => void;
    /** Replace one curve (an empty list removes it). */
    putCurve: (id: AutomationParamId, points: AutomationPoint[]) => void;
    /** Replace every curve. */
    setCurves: (data: AutomationData) => void;
    clearParam: (id: AutomationParamId) => void;
    clearAll: () => void;
}

export const useAutomation = create<AutomationState>((set) => ({
    curves: {},
    armed: false,
    setArmed: (armed) => set({ armed }),
    putCurve: (id, points) =>
        set((s) => {
            const curves = { ...s.curves };
            if (points.length === 0) delete curves[id];
            else curves[id] = points;
            return { curves };
        }),
    setCurves: (data) => set({ curves: data }),
    clearParam: (id) =>
        set((s) => {
            const curves = { ...s.curves };
            delete curves[id];
            return { curves };
        }),
    clearAll: () => set({ curves: {} }),
}));

export const hasCurve = (curves: AutomationData, id: AutomationParamId) => (curves[id]?.length ?? 0) > 0;
