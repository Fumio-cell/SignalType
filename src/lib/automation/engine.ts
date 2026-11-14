import { useAppStore } from '@/store/appStore';
import { useAutomation } from './store';
import { AUTOMATION_PARAMS, PARAM_BY_ID, type AutomationParam } from './params';
import { MIN_POINT_GAP, punchIn, valueAt } from './curve';
import type { AutomationParamId, AutomationPoint } from './types';

/**
 * Reads the curves into the settings, and records knob moves into the curves.
 *
 * applyAutomationAt(t) is a pure function of (curves, t): it sets every automated knob to the value its curve has at t and keeps
 * nothing from earlier calls, so the preview, a seek and an export that all ask for the same t get the same settings.
 */

const clamp = (p: AutomationParam, v: number) => Math.min(p.max, Math.max(p.min, v));

type NumberMap = Record<string, number>;
const current = (p: AutomationParam): number => (useAppStore.getState().settings[p.target] as unknown as NumberMap)[p.key];

/** A knob moved by hand a moment ago while recording keeps its hand-set value until the hand lets go (preview only). */
const TOUCH_MS = 300;
const touched = new Map<AutomationParamId, number>();

/**
 * Set every automated knob to its curve value at time t.
 * `ignoreTouch` is for exports, which never have a hand on a knob.
 */
export function applyAutomationAt(t: number, ignoreTouch = false): void {
    const curves = useAutomation.getState().curves;
    const render: NumberMap = {};
    const glitch: NumberMap = {};
    let changed = false;
    const now = performance.now();
    for (const p of AUTOMATION_PARAMS) {
        const points = curves[p.id];
        if (!points || points.length === 0) continue;
        if (!ignoreTouch && now - (touched.get(p.id) ?? -Infinity) < TOUCH_MS) continue;
        const v = clamp(p, valueAt(points, t, current(p)));
        if (v !== current(p)) {
            (p.target === 'render' ? render : glitch)[p.key] = v;
            changed = true;
        }
    }
    if (!changed) return;
    useAppStore.setState((s) => ({
        settings: {
            ...s.settings,
            render: { ...s.settings.render, ...render },
            glitch: { ...s.settings.glitch, ...glitch },
        },
    }));
}

interface Take {
    /** The curve as it was when this take began: the take is punched into it. */
    snapshot: AutomationPoint[];
    points: AutomationPoint[];
    lastEvent: number;
    lastT: number;
}
const takes = new Map<AutomationParamId, Take>();

export function isRecording(): boolean {
    const s = useAppStore.getState();
    return useAutomation.getState().armed && s.isPlaying && s.audioBuffer !== null;
}

/**
 * A knob was moved by hand to `value`. When armed and playing, record it at the current playback position.
 * One point per 16 ms at most; a later take over the same time range replaces the old points of that range (punch-in).
 */
export function recordChange(id: AutomationParamId, value: number): void {
    if (!isRecording()) return;
    const p = PARAM_BY_ID[id];
    const t = useAppStore.getState().currentTime;
    const now = performance.now();
    const v = clamp(p, value);
    let take = takes.get(id);
    if (!take || now - take.lastEvent > 400 || t < take.lastT - 0.05) {
        take = { snapshot: useAutomation.getState().curves[id] ?? [], points: [], lastEvent: now, lastT: t };
        takes.set(id, take);
    }
    const last = take.points[take.points.length - 1];
    if (last && t - last.t < MIN_POINT_GAP) last.v = v;
    else take.points.push({ t, v });
    take.lastEvent = now;
    take.lastT = Math.max(take.lastT, t);
    touched.set(id, now);
    useAutomation.getState().putCurve(id, punchIn(take.snapshot, take.points));
}

export function clearAutomation(id: AutomationParamId): void {
    takes.delete(id);
    touched.delete(id);
    useAutomation.getState().clearParam(id);
}

export function clearAllAutomation(): void {
    takes.clear();
    touched.clear();
    useAutomation.getState().clearAll();
}

let started = false;

/** Called once at startup: keep the settings on the curves while the playhead moves, and forget takes when playback stops. */
export function initAutomation(): void {
    if (started) return;
    started = true;
    useAppStore.subscribe((state, prev) => {
        if (state.currentTime !== prev.currentTime) applyAutomationAt(state.currentTime);
        if (prev.isPlaying && !state.isPlaying) {
            takes.clear();
            touched.clear();
        }
    });
    useAutomation.subscribe((state, prev) => {
        if (state.curves !== prev.curves) applyAutomationAt(useAppStore.getState().currentTime);
        if (!state.armed && prev.armed) {
            takes.clear();
            touched.clear();
        }
    });
}
