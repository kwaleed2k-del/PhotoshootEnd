import React, { useState, useRef, useEffect } from 'react';
import { Download, Edit, Lock, Video, Save, Loader2, Bot } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { useAuth } from '../../context/AuthContext';
import { ANIMATION_STYLES_LIBRARY } from '../../constants';

export const ImageToolbar: React.FC = () => {
    const { 
        generatedImages, 
        activeImageIndex, 
        startEditing, 
        generatedVideoUrl, 
        studioMode, 
        generateVideoFromImage, 
        isGenerating,
        isApplyingPost,
        saveModel,
        isSavingModel,
        applyHologramEffect
    } = useStudio();
    const { hasPermission, incrementGenerationsUsed } = useAuth();
    const [isAnimateMenuOpen, setAnimateMenuOpen] = useState(false);
    const animateButtonRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (animateButtonRef.current && !animateButtonRef.current.contains(event.target as Node)) {
                setAnimateMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const activeImage = activeImageIndex !== null && generatedImages ? generatedImages[activeImageIndex] : null;
    const canUseGenerativeEdit = hasPermission('generativeEdit');
    const canUseVideoGeneration = hasPermission('videoGeneration');

    const handleEdit = () => {
        if (activeImageIndex !== null && canUseGenerativeEdit) {
            startEditing(activeImageIndex);
        }
    };
    
    const handleSaveModel = () => {
        if (activeImage) {
            saveModel(activeImage);
        }
    };

    const handleHologram = () => {
        if(activeImage) {
            applyHologramEffect();
        }
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        if (activeImage) {
            link.href = activeImage;
            link.download = `virtual-photoshoot-${activeImageIndex + 1}.jpg`;
        } else if (generatedVideoUrl) {
            link.href = generatedVideoUrl;
            link.download = `virtual-photoshoot.mp4`;
        }
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Shared classes for secondary buttons for consistency
    const secondaryButtonClass = "w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-semibold text-zinc-100 bg-zinc-800 hover:bg-zinc-700 h-10 px-4 rounded-lg transition-colors border border-white/10 disabled:opacity-60 disabled:cursor-not-allowed";

    return (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center sm:justify-end gap-2 w-full">
            {activeImage && studioMode === 'apparel' && (
                <div ref={animateButtonRef} className="relative w-full sm:w-auto">
                    <button
                        onClick={() => setAnimateMenuOpen(prev => !prev)}
                        disabled={!canUseVideoGeneration || isGenerating}
                        title={!canUseVideoGeneration ? 'Video generation is available on Studio and Brand plans' : 'Animate this image'}
                        className={`${secondaryButtonClass} w-full`}
                    >
                        <Video size={16} />
                        <span className="hidden lg:inline">Animate</span>
                        {!canUseVideoGeneration && <Lock size={12} className="ml-1 text-violet-400" />}
                    </button>
                    {isAnimateMenuOpen && canUseVideoGeneration && (
                        <div className="absolute bottom-full right-0 sm:right-auto sm:left-0 mb-2 w-56 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl z-20 p-2 animate-fade-in" style={{ animationDuration: '150ms' }}>
                            <p className="text-xs text-zinc-400 px-2 pb-2 border-b border-white/10 mb-1">Choose an animation style</p>
                            {ANIMATION_STYLES_LIBRARY.map(anim => (
                                <button
                                    key={anim.id}
                                    onClick={() => {
                                        generateVideoFromImage(anim, incrementGenerationsUsed);
                                        setAnimateMenuOpen(false);
                                    }}
                                    className="w-full text-left p-2 text-sm rounded-md hover:bg-zinc-800 transition-colors text-zinc-300"
                                >
                                    {anim.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {activeImage && studioMode === 'apparel' && (
                <button
                    onClick={handleSaveModel}
                    disabled={isSavingModel}
                    title={'Save this model to "My Agency" for consistent reuse'}
                    className={secondaryButtonClass}
                >
                    {isSavingModel ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span className="hidden lg:inline">Save Model</span>
                </button>
            )}
            {activeImage && studioMode === 'product' && (
                 <button
                    onClick={handleHologram}
                    disabled={!canUseGenerativeEdit || isApplyingPost}
                    title={!canUseGenerativeEdit ? 'This feature is available on Studio and Brand plans' : 'Hologram Effect'}
                    className={secondaryButtonClass}
                >
                    <Bot size={16} />
                    <span className="hidden lg:inline">Hologram FX</span>
                    {!canUseGenerativeEdit && <Lock size={12} className="ml-1 text-violet-400" />}
                </button>
            )}
             {activeImage && (
                <button
                    onClick={handleEdit}
                    disabled={!canUseGenerativeEdit}
                    title={!canUseGenerativeEdit ? 'Generative Edit is available on Studio and Brand plans' : 'Edit Image'}
                    className={secondaryButtonClass}
                >
                    <Edit size={16} />
                    <span className="hidden lg:inline">Edit</span>
                    {!canUseGenerativeEdit && <Lock size={12} className="ml-1 text-violet-400" />}
                </button>
            )}

            {/* Primary Action */}
            <button
                onClick={handleDownload}
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-semibold text-white bg-brand-primary hover:bg-brand-primary-hover h-10 px-5 rounded-lg transition-all duration-300 shadow-lg shadow-brand-glow/40 hover:shadow-xl hover:shadow-brand-glow/60"
            >
                <Download size={16} />
                <span>Download</span>
            </button>
        </div>
    );
};
