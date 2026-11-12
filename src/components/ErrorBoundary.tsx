import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Stage failed:', error, info.componentStack);
    }

    render() {
        if (this.state.error) {
            return (
                <div role="alert" className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-zinc-300">
                    The stage could not start. Reload the page to try again.
                </div>
            );
        }
        return this.props.children;
    }
}
