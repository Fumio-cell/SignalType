import { useEffect } from 'react';
import { useNoticeStore, type Notice } from '@/lib/notify';

const AUTO_DISMISS_MS = 12000;

function NoticeItem({ notice }: { notice: Notice }) {
    const dismiss = useNoticeStore((s) => s.dismiss);

    // Info notices clear themselves; errors stay until dismissed.
    useEffect(() => {
        if (notice.tone === 'error') return;
        const t = window.setTimeout(() => dismiss(notice.id), AUTO_DISMISS_MS);
        return () => window.clearTimeout(t);
    }, [notice, dismiss]);

    return (
        <div className="notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>
            <div className="flex-1">
                <p className="m-0">{notice.message}</p>
                {notice.action && (
                    <a
                        href={notice.action.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="control mt-sp2 inline-block text-paper underline underline-offset-4"
                    >
                        {notice.action.label}
                    </a>
                )}
            </div>
            <button type="button" className="btn" onClick={() => dismiss(notice.id)}>
                Dismiss
            </button>
        </div>
    );
}

export function NoticeHost() {
    const notices = useNoticeStore((s) => s.notices);
    return (
        <div
            role="region"
            aria-label="Notices"
            className="pointer-events-none fixed bottom-20 left-sp4 z-40 flex flex-col gap-sp2"
        >
            {notices.map((n) => (
                <div key={n.id} className="pointer-events-auto">
                    <NoticeItem notice={n} />
                </div>
            ))}
        </div>
    );
}
