import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
    onClose: () => void;
}

/**
 * Modal dialog: focus moves in on open, Tab is trapped, Esc closes,
 * focus returns to the element that opened it. The app root is inert while open.
 */
export function InfoDialog({ onClose }: Props) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        const root = document.getElementById('root');
        root?.setAttribute('inert', '');
        closeRef.current?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab') return;
            const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
            if (nodes.length === 0) {
                e.preventDefault();
                return;
            }
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            const active = document.activeElement;
            if (!dialogRef.current?.contains(active)) {
                e.preventDefault();
                first.focus();
            } else if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            root?.removeAttribute('inert');
            opener?.focus();
        };
    }, []);

    return createPortal(
        <div className="dialog-scrim" onClick={onClose}>
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="info-dialog-title"
                aria-describedby="info-dialog-body"
                className="dialog"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    ref={closeRef}
                    type="button"
                    className="btn btn-icon absolute right-sp3 top-sp3"
                    aria-label="Close"
                    onClick={onClose}
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
                <h2 id="info-dialog-title" className="control m-0 mb-sp2 text-paper">
                    SignalType
                </h2>
                <p className="control m-0 mb-sp4 text-paper-dim">Text animation driven by an audio file</p>
                <div id="info-dialog-body">
                    <p className="m-0 mb-sp3 leading-relaxed text-paper">
                        Type text, load an audio file, and SignalType draws the text in 3D or flat, horizontal or
                        vertical. Onsets in the audio change the line. Loudness and beats move the ink bleed, the
                        depth and the light, and the glitch.
                    </p>
                    <p className="m-0 mb-sp3 leading-relaxed text-paper">
                        It exports an MP4 or a PNG sequence with alpha, at 1080p or 4K. The MP4 has no audio track:
                        it is an overlay, and your track is already in your timeline.
                    </p>
                    <p className="m-0 mb-sp3 leading-relaxed text-paper">
                        Nothing is uploaded. Your audio, fonts and frames stay in this browser tab.
                    </p>
                    <p className="control m-0 text-paper-dim">
                        Looks: Weight, Ink, Interference. Fonts: bundled, or any TTF or OTF you import.
                    </p>
                </div>
            </div>
        </div>,
        document.body,
    );
}
