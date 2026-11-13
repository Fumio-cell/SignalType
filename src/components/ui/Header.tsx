import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { DEMO_MODE } from '../../config';
import { InfoDialog } from './InfoDialog';

export const Header: React.FC = () => {
    const [showInfo, setShowInfo] = useState(false);

    return (
        <header className="signal-header">
            <div className="flex items-center gap-sp4">
                <div className="flex items-center gap-sp2 text-paper">
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 48 48"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                        aria-hidden="true"
                    >
                        <path d="M14 24 L20 16 L26 24 L20 32 Z" />
                        <circle cx="20" cy="24" r="1.6" fill="currentColor" stroke="none" />
                        <path d="M26 24 L34 24" />
                        <circle cx="36" cy="24" r="2.4" />
                    </svg>
                    <h1 className="display m-0 text-[22px] text-paper">SignalType</h1>
                </div>
                <span className="control text-paper-label">Poetic Signal Toolkit</span>
                <button
                    type="button"
                    className="btn btn-icon"
                    aria-label="About SignalType"
                    aria-haspopup="dialog"
                    onClick={() => setShowInfo(true)}
                >
                    <Info className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>

            <div className="flex items-center gap-sp5">
                <div>
                    <p className="control m-0 mb-sp1 text-paper-dim">NOTHING LEAVES THIS MACHINE</p>
                    <p className="display m-0 text-[15px] text-paper">No upload. No account. The file is made here.</p>
                </div>
                {DEMO_MODE && (
                    <span className="control border border-line-control bg-ink-panel px-sp3 py-sp1 text-paper-dim">
                        Free preview
                    </span>
                )}
            </div>

            {showInfo && <InfoDialog onClose={() => setShowInfo(false)} />}
        </header>
    );
};
