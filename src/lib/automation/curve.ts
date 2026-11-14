import type { AutomationPoint } from './types';

/** At most one point per knob in this many seconds, so dragging cannot flood the curve. */
export const MIN_POINT_GAP = 0.016;

/**
 * The value of a curve at time t. Before the first point the first value holds, after the last point the last value holds,
 * between two points it is linear. `fallback` is the knob's current value, used when there are no points.
 */
export function valueAt(points: AutomationPoint[] | undefined, t: number, fallback: number): number {
    if (!points || points.length === 0) return fallback;
    if (t <= points[0].t) return points[0].v;
    const last = points[points.length - 1];
    if (t >= last.t) return last.v;
    // the first point whose time is greater than t
    let lo = 0;
    let hi = points.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (points[mid].t > t) hi = mid;
        else lo = mid + 1;
    }
    const a = points[lo - 1];
    const b = points[lo];
    const span = b.t - a.t;
    return span <= 0 ? b.v : a.v + ((b.v - a.v) * (t - a.t)) / span;
}

/**
 * Punch-in: the curve with the points of a take put in. Points of the old curve inside the take's time range
 * [take[0].t, take[last].t] are replaced; everything outside it stays.
 */
export function punchIn(old: AutomationPoint[], take: AutomationPoint[]): AutomationPoint[] {
    if (take.length === 0) return old;
    const t0 = take[0].t;
    const t1 = take[take.length - 1].t;
    return [...old.filter((p) => p.t < t0 || p.t > t1), ...take].sort((a, b) => a.t - b.t);
}
