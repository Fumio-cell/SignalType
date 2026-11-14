import { X } from 'lucide-react';
import { useAutomation, hasCurve } from '@/lib/automation/store';
import { clearAutomation } from '@/lib/automation/engine';
import { PARAM_BY_ID } from '@/lib/automation/params';
import type { AutomationParamId } from '@/lib/automation/types';

/** "AUTO" and a button that removes the knob's automation, shown next to a knob that has some. */
export function AutoMark({ id }: { id: AutomationParamId }) {
    const has = useAutomation((s) => hasCurve(s.curves, id));
    if (!has) return null;
    const name = PARAM_BY_ID[id].label;
    return (
        <span className="control flex items-center gap-sp1 text-paper" data-testid={`auto-${id}`}>
            Auto
            <button
                type="button"
                className="btn btn-icon !p-[2px]"
                aria-label={`Clear automation of ${name}`}
                title={`Clear automation of ${name}`}
                onClick={() => clearAutomation(id)}
            >
                <X className="h-3 w-3" aria-hidden="true" />
            </button>
        </span>
    );
}
