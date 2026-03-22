import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase, openLemonSqueezyCheckout } from '../../lib/commercial';
import { LogIn, LogOut, Zap, Info, X } from 'lucide-react';

export const Header: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [isPro, setIsPro] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        const client = supabase;
        if (!client) return;

        client.auth.getUser().then(({ data: { user: foundUser } }: any) => {
            setUser(foundUser);
            if (foundUser) {
                client
                    .from('profiles')
                    .select('is_pro')
                    .eq('id', foundUser.id)
                    .single()
                    .then(({ data }: any) => {
                        const pro = !!(data as any)?.is_pro;
                        const finalPro = pro || foundUser?.email === 'fumiotashiro@gmail.com';
                        (window as any).__isPro = finalPro;
                        setIsPro(finalPro);
                        window.dispatchEvent(new CustomEvent('auth:status', { detail: { user: foundUser, isPro: finalPro } }));
                        setTimeout(() => window.dispatchEvent(new CustomEvent('auth:status', { detail: { user: foundUser, isPro: finalPro } })), 200);
                    });
            }
        });

        const { data: authListener } = client.auth.onAuthStateChange(async (_event: any, session: any) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (currentUser) {
                const { data }: any = await client
                    .from('profiles')
                    .select('is_pro')
                    .eq('id', currentUser.id)
                    .single();
                const pro = !!(data as any)?.is_pro;
                const finalPro = pro || currentUser?.email === 'fumiotashiro@gmail.com';
                (window as any).__isPro = finalPro;
                setIsPro(finalPro);
                window.dispatchEvent(new CustomEvent('auth:status', { detail: { user: currentUser, isPro: finalPro } }));
                setTimeout(() => window.dispatchEvent(new CustomEvent('auth:status', { detail: { user: currentUser, isPro: finalPro } })), 200);
            } else {
                setIsPro(false);
                window.dispatchEvent(new CustomEvent('auth:status', { detail: { user: null, isPro: false } }));
            }
        });

        const handleBuyPro = () => openLemonSqueezyCheckout();
        window.addEventListener('app:buyPro', handleBuyPro);

        return () => {
            authListener?.subscription.unsubscribe();
            window.removeEventListener('app:buyPro', handleBuyPro);
        };
    }, []);

    const login = () => supabase?.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    const logout = () => supabase?.auth.signOut();

    return (
        <header className="toolkit-header">
            <div className="header-left">
                <div className="toolkit-brand">
                    <svg className="brand-icon" viewBox="0 0 48 48" fill="none"><path d="M16 38 L24 10 L32 38" stroke="#7c5cfc" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><line x1="19" y1="28" x2="29" y2="28" stroke="#7c5cfc" strokeWidth="1.5" strokeLinecap="round"/><line x1="14" y1="20" x2="36" y2="20" stroke="#5ce0fc" strokeWidth="0.8" opacity="0.5"/><path d="M28 22 L30 16" stroke="#5ce0fc" strokeWidth="1.5" opacity="0.6" strokeLinecap="round"/></svg>
                    <span className="toolkit-name">Poetic Signal Toolkit</span>
                </div>
                <div className="app-separator">/</div>
                <div className="app-name">SignalType</div>
                <button onClick={() => setShowInfo(true)} className="info-btn">
                    <Info className="w-4 h-4" />
                </button>
            </div>

            <div className="header-right">
                {user ? (
                    <div className="user-profile">
                        <div className={`pro-badge ${isPro ? 'active' : ''}`}>
                            <Zap className="w-3 h-3" />
                            {isPro ? 'PRO' : 'FREE'}
                        </div>
                        <span className="user-email">{user.email}</span>
                        {!isPro && (
                            <button onClick={() => openLemonSqueezyCheckout()} className="upgrade-btn">
                                Upgrade
                            </button>
                        )}
                        <button onClick={logout} className="icon-btn" title="Logout">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <button onClick={login} className="login-btn">
                        <LogIn className="w-4 h-4" />
                        Login
                    </button>
                )}
            </div>

            <style>{`
                .toolkit-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem 1.5rem;
                    background: rgba(15, 23, 42, 0.85);
                    backdrop-filter: blur(12px);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    font-size: 0.875rem;
                }
                .header-left, .header-right {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                .toolkit-brand {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #7c5cfc;
                }
                .brand-icon {
                    width: 1.25rem;
                    height: 1.25rem;
                }
                .toolkit-name {
                    font-size: 0.85rem;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                    color: #fff;
                }
                .app-separator {
                    color: rgba(255, 255, 255, 0.2);
                    font-weight: 300;
                    margin: 0 0.25rem;
                }
                .app-name {
                    color: rgba(255, 255, 255, 0.7);
                    font-size: 0.85rem;
                    font-weight: 500;
                }
                .user-profile {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: rgba(255, 255, 255, 0.06);
                    padding: 0.35rem 0.5rem 0.35rem 0.75rem;
                    border-radius: 9999px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .pro-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.7rem;
                    font-weight: 800;
                    padding: 0.2rem 0.5rem;
                    border-radius: 9999px;
                    background: rgba(255, 255, 255, 0.1);
                    color: #94a3b8;
                    letter-spacing: 0.05em;
                }
                .pro-badge.active {
                    background: #f59e0b;
                    color: #fff;
                    box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
                }
                .user-email {
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.9);
                    font-weight: 500;
                    letter-spacing: 0.01em;
                }
                .upgrade-btn {
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: #fff;
                    border: none;
                    padding: 0.3rem 0.8rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.25);
                }
                .upgrade-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
                }
                .login-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: #fff;
                    color: #0f172a;
                    border: none;
                    padding: 0.5rem 1.25rem;
                    border-radius: 9999px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);
                }
                .login-btn:hover {
                    background: #f8fafc;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
                }
                .icon-btn {
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.5);
                    cursor: pointer;
                    padding: 0.4rem;
                    display: flex;
                    align-items: center;
                    border-radius: 50%;
                    transition: all 0.2s ease;
                }
                .icon-btn:hover {
                    color: #fff;
                    background: rgba(255, 255, 255, 0.1);
                }
           
                .info-modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
                    display: flex; align-items: center; justify-content: center; z-index: 99999;
                }
                .info-modal {
                    background: #111827; border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 16px; padding: 32px; max-width: 600px;
                    width: 90%; max-height: 85vh; overflow-y: auto;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                    position: relative;
                    text-align: left;
                }
                .info-modal h2 { margin-top: 0; color: #f8fafc; font-size: 1.5rem; }
                .info-modal h3 { color: #7c5cfc; font-size: 0.85rem; margin-bottom: 24px; font-weight: 600; }
                .info-modal p { color: #cbd5e1; line-height: 1.6; font-size: 0.9rem; margin-bottom: 12px; }
                .info-modal ul { color: #cbd5e1; font-size: 0.85rem; padding-left: 20px; list-style-type: none; margin:0; padding:0; }
                .info-modal li { margin-bottom: 8px; font-weight: 500; color: #94a3b8; }
                .info-close {
                    position: absolute; top: 16px; right: 16px;
                    background: transparent; border: none; color: #64748b;
                    cursor: pointer; padding: 6px; border-radius: 6px; transition: all 0.2s;
                }
                .info-close:hover { color: #f8fafc; background: rgba(255,255,255,0.1); }
                .info-btn {
                    background: transparent; border: none; color: #64748b; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    margin-left: 12px; transition: color 0.2s;
                }
                .info-btn:hover { color: #f8fafc; }
    
            `}
            </style>
        
            {showInfo && createPortal(
                <div className="info-modal-overlay" onClick={() => setShowInfo(false)}>
                    <div className="info-modal" onClick={e => e.stopPropagation()}>
                        <button className="info-close" onClick={() => setShowInfo(false)}><X className="w-5 h-5"/></button>
                        <h2>SignalType</h2>
                        <h3>Kinetic Typography & Typographic Interference | キネティック・タイポグラフィ＆文字干渉システム</h3>
                        
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', marginBottom: '8px' }}>EN</div>
                            <p>SignalType reimagines text as kinetic light and geometry. Focused entirely on typography, it turns inputted words and characters into dynamic 3D elements that react to invisible signals, audio inputs, and glitch algorithms. It generates stunning animated title sequences, corrupted letterforms, and abstract typographic posters perfect for modern digital art and video intros.</p>
                            <ul><li>Key Features: 3D Text Rendering, Glitch Injection, Audio-Reactive Typography, Custom Font Loading.</li></ul>
                        </div>

                        <div>
                            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', marginBottom: '8px' }}>JP</div>
                            <p>SignalTypeは、テキスト（文字）を動的な光や幾何学として再解釈するツールです。入力された文字を3Dのキネティック（動的）オブジェクトへと変換し、音からの入力やグリッチ・アルゴリズムなど、目に見えない「シグナル」に反応して文字が破壊・再構築されます。美しくも破壊的なタイトルシーケンスや、アブストラクトなタイポグラフィ・アート、グリッチポスターなどをブラウザ上で容易に生成することができます。</p>
                            <ul><li>主要機能: 3Dテキスト・レンダリング、グリッチ・インジェクション、オーディオ・リアクティブタイポグラフィ、カスタムフォント読み込み。</li></ul>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </header>
    );
};
