import { create } from 'zustand';

export interface NoticeAction {
    label: string;
    href: string;
}

export interface Notice {
    /** Notices with the same id replace each other, so repeated triggers do not stack. */
    id: string;
    message: string;
    tone: 'info' | 'error';
    action?: NoticeAction;
}

interface NoticeState {
    notices: Notice[];
    push: (notice: Notice) => void;
    dismiss: (id: string) => void;
}

const useNoticeStore = create<NoticeState>((set) => ({
    notices: [],
    push: (notice) =>
        set((s) => ({ notices: [...s.notices.filter((n) => n.id !== notice.id), notice] })),
    dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));

let counter = 0;

/** In-screen notification, used instead of the browser dialogs. */
export function notify(
    message: string,
    options: { id?: string; tone?: 'info' | 'error'; action?: NoticeAction } = {},
): void {
    useNoticeStore.getState().push({
        id: options.id ?? `notice-${++counter}`,
        message,
        tone: options.tone ?? 'info',
        action: options.action,
    });
}

export function dismissNotice(id: string): void {
    useNoticeStore.getState().dismiss(id);
}

export { useNoticeStore };
