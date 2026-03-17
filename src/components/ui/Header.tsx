import { useEffect, useState } from 'react';
import { supabase, getUserStatus, signInWithGoogle, signOut } from '../../lib/commercial';
import { User, LogOut, Zap } from 'lucide-react';

const Header = () => {
    const [user, setUser] = useState<any>(null);
    const [isPro, setIsPro] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            const status = await getUserStatus();
            setUser(status.user);
            setIsPro(status.isPro);
            
            window.dispatchEvent(new CustomEvent('auth:status', { detail: status }));
        };

        checkStatus();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event: any) => {
            const status = await getUserStatus();
            setUser(status.user);
            setIsPro(status.isPro);
            window.dispatchEvent(new CustomEvent('auth:status', { detail: status }));
            
            if (event === 'SIGNED_IN') {
                window.history.replaceState(null, '', window.location.pathname);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    return (
        <header className="flex items-center justify-between px-6 h-16 bg-zinc-900 border-b border-zinc-800 shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-sky-500 flex items-center justify-center text-white font-bold shadow-lg">S</div>
                <div>
                    <h1 className="text-lg font-bold leading-none">SignalType</h1>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5 block">Poetic Signal Toolkit</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {!isPro && (
                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('app:buyPro'))}
                        className="px-3.5 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/20"
                    >
                        <Zap size={12} fill="white" />
                        Upgrade to PRO
                    </button>
                )}

                {user ? (
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span className="max-w-[150px] truncate">{user.email}</span>
                        <button 
                            onClick={() => signOut()}
                            className="text-zinc-500 hover:text-white transition-colors"
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={() => signInWithGoogle()}
                        className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-white flex items-center gap-2 transition-colors border border-zinc-700/50"
                    >
                        <User size={14} />
                        Login
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
