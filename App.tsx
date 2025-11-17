

import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useStudio } from './context/StudioContext';
import { InputPanel } from './components/shared/InputPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { StudioView } from './components/studio/StudioView';
 
import { StudioModeSwitcher } from './components/shared/StudioModeSwitcher';
import { GenerateButton } from './components/shared/GenerateButton';
import { InteractiveGuide } from './components/shared/InteractiveGuide';
import { BestPracticesModal } from './components/shared/BestPracticesModal';
import { PricingModal } from './components/shared/PricingModal';
import { LandingPage } from './components/landing/LandingPage';
import { DatabaseTest } from './components/shared/DatabaseTest';
import { ImageProcessingNotification } from './components/shared/ImageProcessingNotification';
import { StudioModeSelector } from './components/studio/StudioModeSelector';
import { BillingOverview } from './src/pages/BillingOverview';
import Dashboard from './src/pages/Dashboard';
import Account from './src/pages/Account';
import { Wand2, User, PanelLeft, PanelRight, Lightbulb, DollarSign, LogOut, HelpCircle, ChevronDown, Database } from 'lucide-react';
import { PLAN_DETAILS } from './services/permissionsService';
import { supabase } from './services/supabaseClient';

const UserMenu: React.FC<{ 
    onPricingOpen: () => void;
    onBestPracticesOpen: () => void;
    onGuideOpen: () => void;
    onShowDatabaseTest: () => void;
}> = ({ onPricingOpen, onBestPracticesOpen, onGuideOpen, onShowDatabaseTest }) => {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    if (!user) return null;

    const planDetails = PLAN_DETAILS[user.plan];
    const generationsPercentage = (user.generationsUsed / planDetails.generations) * 100;

    return (
        <div className="relative" ref={menuRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <User size={18} />
                <span className="hidden sm:inline text-sm font-medium">{user.email}</span>
                <ChevronDown size={16} className={`text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl z-50 p-2 animate-fade-in duration-150">
                    <div className="p-2 border-b border-white/10">
                        <p className="text-sm font-semibold text-white truncate">{user.email}</p>
                        <p className="text-xs text-zinc-400">Plan: <span className="font-bold text-violet-400">{planDetails.name}</span></p>
                    </div>
                    <div className="p-2 text-xs text-zinc-400">
                        <p>Generations used: {user.generationsUsed} / {planDetails.generations}</p>
                        <div className="w-full bg-zinc-700 rounded-full h-1.5 mt-1">
                            <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${generationsPercentage}%` }}></div>
                        </div>
                    </div>
                    <div className="my-1 h-px bg-white/10" />
                    <button onClick={() => { onBestPracticesOpen(); setIsOpen(false); }} className="w-full flex items-center gap-3 p-2 text-sm text-left rounded-md hover:bg-zinc-800 transition-colors text-zinc-300">
                        <Lightbulb size={16} /> Best Practices
                    </button>
                    <button onClick={() => { onGuideOpen(); setIsOpen(false); }} className="w-full flex items-center gap-3 p-2 text-sm text-left rounded-md hover:bg-zinc-800 transition-colors text-zinc-300">
                        <HelpCircle size={16} /> Interactive Guide
                    </button>
                    <button onClick={() => { onShowDatabaseTest(); setIsOpen(false); }} className="w-full flex items-center gap-3 p-2 text-sm text-left rounded-md hover:bg-zinc-800 transition-colors text-zinc-300">
                        <Database size={16} /> Database Test
                    </button>
                    <div className="my-1 h-px bg-white/10" />
                    <button onClick={() => { onPricingOpen(); setIsOpen(false); }} className="w-full flex items-center gap-3 p-2 text-sm text-left rounded-md hover:bg-zinc-800 transition-colors text-zinc-300">
                        <DollarSign size={16} /> Manage Plan
                    </button>
                    <a href="/account" onClick={(e) => { e.preventDefault(); window.location.href = '/account'; }} className="w-full flex items-center gap-3 p-2 text-sm text-left rounded-md hover:bg-zinc-800 transition-colors text-zinc-300">
                        <User size={16} /> Account
                    </a>
                    <a href="/billing" onClick={(e) => { e.preventDefault(); window.location.href = '/billing'; }} className="w-full flex items-center gap-3 p-2 text-sm text-left rounded-md hover:bg-zinc-800 transition-colors text-zinc-300">
                        <DollarSign size={16} /> Billing & Credits
                    </a>
                    <button onClick={logout} className="w-full flex items-center gap-3 p-2 text-sm text-left rounded-md hover:bg-zinc-800 transition-colors text-zinc-300">
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            )}
        </div>
    );
};

const AppHeader: React.FC<{
    toggleLeftPanel: () => void;
    toggleRightPanel: () => void;
    onShowDatabaseTest: () => void;
    onBackToModeSelector: () => void;
}> = ({ toggleLeftPanel, toggleRightPanel, onShowDatabaseTest, onBackToModeSelector }) => {
    const { setBestPracticesModalOpen, setGuideActive, studioMode } = useStudio();
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

    const modeNames = {
        apparel: 'Fashion Model Studio',
        product: 'Product Photography Studio',
        video: 'Video Generation Studio'
    };

    return (
        <>
            <header className="flex-shrink-0 p-2 border-b border-white/10 grid grid-cols-3 items-center gap-4 bg-zinc-925/70 backdrop-blur-xl z-40 shadow-lg shadow-black/20">
                <div className="flex items-center justify-start gap-2">
                    <button onClick={toggleLeftPanel} className="p-2 rounded-lg hover:bg-zinc-800 lg:hidden" aria-label="Toggle input panel">
                        <PanelLeft size={20} />
                    </button>
                    <a href="/" className="flex items-center gap-2" aria-label="Go to dashboard home">
                        <Wand2 size={24} className="text-violet-400" />
                        <h1 className="hidden md:block text-lg font-bold text-zinc-100">Lenci Studio</h1>
                    </a>
                </div>

                <div className="hidden sm:flex justify-center items-center">
                    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/50 border border-zinc-700/50 rounded-full">
                        <span className="text-sm font-medium text-zinc-300">{modeNames[studioMode]}</span>
                        <button
                            onClick={onBackToModeSelector}
                            className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors text-zinc-400 hover:text-zinc-200"
                        >
                            Change
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-1 sm:gap-2">
                    <div id="generate-button-container">
                        <GenerateButton />
                    </div>
                    <UserMenu 
                        onPricingOpen={() => setIsPricingModalOpen(true)}
                        onBestPracticesOpen={() => setBestPracticesModalOpen(true)}
                        onGuideOpen={() => setGuideActive(true)}
                        onShowDatabaseTest={onShowDatabaseTest}
                    />
                    <button onClick={toggleRightPanel} className="p-2 rounded-lg hover:bg-zinc-800 lg:hidden xl:hidden" aria-label="Toggle settings panel">
                        <PanelRight size={20} />
                    </button>
                </div>
            </header>
            <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
        </>
    );
};


const AppContent: React.FC = () => {
    const { isGuideActive, isBestPracticesModalOpen, setBestPracticesModalOpen, showProcessingNotification, processingMessage, processingProgress, setProcessingNotification, studioMode, setStudioMode } = useStudio();
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
    const [showStudio, setShowStudio] = useState(false);
    const [showModeSelector, setShowModeSelector] = useState(false);
    const [showDatabaseTest, setShowDatabaseTest] = useState(false);
    const [showBilling, setShowBilling] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsLeftPanelOpen(false);
                setIsRightPanelOpen(false);
            } else if (window.innerWidth < 1280) {
                 setIsLeftPanelOpen(true);
                 setIsRightPanelOpen(false);
            } else {
                setIsLeftPanelOpen(true);
                setIsRightPanelOpen(true);
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Allow direct routing to studio flows
    useEffect(() => {
        const path = window.location.pathname;
        if (path === '/studio/apparel') {
            setShowStudio(true);
            setShowModeSelector(false);
            setStudioMode('apparel' as any);
        } else if (path === '/studio/product') {
            setShowStudio(true);
            setShowModeSelector(false);
            setStudioMode('product' as any);
        }
    }, [setStudioMode]);

    // Smart redirect: if a user is authenticated and lands on '/', take them to /dashboard
    useEffect(() => {
        (async () => {
            if (window.location.pathname === '/') {
                const { data } = await supabase.auth.getUser();
                if (data?.user) {
                    window.history.replaceState({}, '', '/dashboard');
                }
            }
        })();
    }, []);
    useEffect(() => {
        // Allow landing page to trigger a specific guided tour
        const handler = (evt: Event) => {
            const e = evt as CustomEvent<{ flow: 'apparel' | 'product' }>;
            setShowStudio(true);
            // Ensure panels visible so elements mount
            setIsLeftPanelOpen(true);
            setIsRightPanelOpen(true);
            // Start the guide after a delay to allow DOM to render
            setTimeout(() => {
                const store = useStudio.getState();
                if (store.startGuide) {
                    store.startGuide(e.detail.flow);
                }
            }, 300);
        };
        window.addEventListener('startStudioGuide', handler as EventListener);
        return () => window.removeEventListener('startStudioGuide', handler as EventListener);
    }, []);

    useEffect(() => {
        const handleShowNotification = (event: CustomEvent) => {
            const { message, progress } = event.detail;
            setProcessingNotification(true, message, progress);
        };

        const handleHideNotification = () => {
            setProcessingNotification(false);
        };

        window.addEventListener('showProcessingNotification', handleShowNotification as EventListener);
        window.addEventListener('hideProcessingNotification', handleHideNotification);

        return () => {
            window.removeEventListener('showProcessingNotification', handleShowNotification as EventListener);
            window.removeEventListener('hideProcessingNotification', handleHideNotification);
        };
    }, [setProcessingNotification]);

    // Show account page
    if (window.location.pathname === '/account') {
        return (
            <div className="min-h-screen">
                <Account />
            </div>
        );
    }

    // Dashboard page after login
    if (window.location.pathname === '/dashboard') {
        return (
            <div className="min-h-screen">
                <Dashboard />
            </div>
        );
    }

    // Show billing page if route is /billing
    if (window.location.pathname === '/billing' || showBilling) {
        return (
            <div className="min-h-screen">
                <BillingOverview />
            </div>
        );
    }

    // Show landing page by default, studio when showStudio is true
    if (!showStudio) {
        return (
            <div className="min-h-screen">
                <LandingPage />
                {/* Add a floating button to access studio */}
                <button
                    onClick={() => {
                        setShowStudio(true);
                        setShowModeSelector(true);
                    }}
                    className="fixed bottom-6 right-6 z-50 bg-violet-600 hover:bg-violet-500 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-105"
                    title="Open Studio"
                >
                    <Wand2 size={24} />
                </button>
            </div>
        );
    }

    // Show mode selector when entering studio for the first time
    if (showModeSelector) {
        return <StudioModeSelector onSelectMode={(mode) => {
            setStudioMode(mode);
            setShowModeSelector(false);
        }} />;
    }

    return (
        <div className="bg-zinc-950 text-zinc-300 font-sans antialiased min-h-screen flex flex-col">
            <AppHeader
                toggleLeftPanel={() => setIsLeftPanelOpen(p => !p)}
                toggleRightPanel={() => setIsRightPanelOpen(p => !p)}
                onShowDatabaseTest={() => setShowDatabaseTest(true)}
                onBackToModeSelector={() => setShowModeSelector(true)}
            />
            <main className="flex-grow flex-1 flex min-h-0 max-h-[calc(100vh-61px)]">
                <aside className={`flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${isLeftPanelOpen ? 'w-[380px]' : 'w-0'} hidden lg:block`}>
                    <div className="w-[380px] flex-1 min-h-0 overflow-y-auto">
                        <InputPanel onClose={() => setIsLeftPanelOpen(false)} />
                    </div>
                </aside>
                
                <section className="min-w-0 flex-1 p-3 overflow-y-auto">
                    <StudioView />
                </section>
                
                <aside className={`flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${isRightPanelOpen ? 'w-[560px]' : 'w-0'} hidden xl:block`}>
                    <div className="w-[560px] flex-1 min-h-0 overflow-y-auto">
                        <SettingsPanel onClose={() => setIsRightPanelOpen(false)} />
                    </div>
                </aside>

                 {/* Mobile floating panels */}
                 <div className={`fixed top-[61px] bottom-0 left-0 w-[380px] max-w-[calc(100%-40px)] z-30 transition-transform duration-300 ease-in-out lg:hidden overflow-y-auto ${isLeftPanelOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <InputPanel onClose={() => setIsLeftPanelOpen(false)} />
                 </div>
                 <div className={`fixed top-[61px] bottom-0 right-0 w-[560px] max-w-[calc(100%-40px)] z-30 transition-transform duration-300 ease-in-out xl:hidden overflow-y-auto ${isRightPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <SettingsPanel onClose={() => setIsRightPanelOpen(false)} />
                 </div>

                 {((isLeftPanelOpen && window.innerWidth < 1024) || (isRightPanelOpen && window.innerWidth < 1280 && window.innerWidth >= 1024)) && (
                    <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => { setIsLeftPanelOpen(false); setIsRightPanelOpen(false); }}></div>
                 )}
            </main>
            
           
            {isGuideActive && <InteractiveGuide />}
            <BestPracticesModal isOpen={isBestPracticesModalOpen} onClose={() => setBestPracticesModalOpen(false)} />
            
            {/* Image Processing Notification */}
            <ImageProcessingNotification 
                isVisible={showProcessingNotification}
                message={processingMessage}
                progress={processingProgress}
            />
            
            {/* Database Test Modal */}
            {showDatabaseTest && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="relative max-w-2xl w-full">
                        <button
                            onClick={() => setShowDatabaseTest(false)}
                            className="absolute -top-4 -right-4 w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors z-10"
                        >
                            ×
                        </button>
                        <DatabaseTest />
                    </div>
                </div>
            )}
        </div>
    );
};

const App: React.FC = () => (
    <AuthProvider>
        <AppContent />
    </AuthProvider>
);

export default App;