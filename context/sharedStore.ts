
import type { Scene, GenerationMode, Animation, AspectRatio, ColorGrade, Look, Background, ShotType } from '../types';
import { BACKGROUNDS_LIBRARY, LIGHTING_PRESETS, ANIMATION_STYLES_LIBRARY, ASPECT_RATIOS_LIBRARY, LIGHTING_PRESETS_PRODUCT, MOCKUP_PACK_SHOTS_3, MOCKUP_PACK_SHOTS_4, ECOMMERCE_PACKS, SOCIAL_MEDIA_PACK_SHOT_IDS, SHOT_TYPES_LIBRARY, EXPRESSIONS, CAMERA_ANGLES_LIBRARY, PRODUCT_ECOMMERCE_PACKS, CAMERA_ANGLES_LIBRARY_PRODUCT, FOCAL_LENGTHS_LIBRARY } from '../constants';
import { geminiService } from '../services/geminiService';
import { promptService } from '../services/promptService';
import type { StudioStoreSlice, StudioStore } from './StudioContext';

const VIDEO_LOADING_MESSAGES = [
    "Warming up the virtual cameras...",
    "Briefing the digital model...",
    "Setting up the lighting rig...",
    "This is a complex shot, adjusting focus...",
    "Rendering the first few frames...",
    "Applying advanced color grading...",
    "Almost there, adding the final touches..."
];

const urlToBase64 = async (url: string): Promise<string> => {
    // Use a proxy for CORS issues if they arise, but for Pexels it should be fine.
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image from URL: ${url}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export interface SharedState {
  studioMode: 'apparel' | 'product' | 'design' | 'reimagine';
  scene: Scene;
  looks: Look[];
  aspectRatio: AspectRatio;
  styleReferenceImage: string | null;
  generatedImages: (string | null)[] | null;
  generatedVideoUrl: string | null;
  videoSourceImage: string | null;
  error: string | null;
  isGenerating: boolean;
  loadingMessage: string;
  isApplyingPost: boolean;
  numberOfImages: number;
  activeImageIndex: number | null;
  isEditing: boolean;
  isApplyingEdit: boolean;
  imageBeingEdited: { original: string; index: number } | null;
  isBestPracticesModalOpen: boolean;
  isGuideActive: boolean;
  generationCount: number;
  pollingIntervalRef: number | null;
  generationIdRef: number;
  isGeneratingBackground: boolean;
  activeImageSources: { web: { uri: string; title: string; } }[] | null;
  // Image processing notification
  showProcessingNotification: boolean;
  processingMessage: string;
  processingProgress: number;
  // Add constants to the store so they can be accessed by other slices via get()
  BACKGROUNDS_LIBRARY: typeof BACKGROUNDS_LIBRARY;
}

export interface SharedActions {
  setStudioMode: (mode: 'apparel' | 'product' | 'design' | 'reimagine') => void;
  clearError: () => void;
  updateScene: (partialScene: Partial<Scene>) => void;
  setProcessingNotification: (show: boolean, message?: string, progress?: number) => void;
  saveLook: (name: string) => void;
  applyLook: (id: string) => void;
  deleteLook: (id: string) => void;
  selectAspectRatio: (ar: AspectRatio) => void;
  setStyleReferenceImage: (base64: string | null) => void;
  generateAsset: (incrementGenerationsUsed: (count: number) => void) => Promise<void>;
  generateVideoFromImage: (animation: Animation, incrementGenerationsUsed: (count: number) => void) => Promise<void>;
  applyColorGrade: (grade: ColorGrade) => Promise<void>;
  setNumberOfImages: (count: number) => void;
  setActiveImageIndex: (index: number | null) => void;
  startEditing: (index: number) => void;
  cancelEditing: () => void;
  applyGenerativeEdit: (maskBase64: string, prompt: string, apparelImageB64?: string | null) => Promise<void>;
  revertEdit: () => void;
  setBestPracticesModalOpen: (isOpen: boolean) => void;
  setGuideActive: (isActive: boolean) => void;
  applyRealismBoost: () => Promise<void>;
  applyFilmGrain: (strength: 'Subtle' | 'Medium') => Promise<void>;
  applyHologramEffect: () => Promise<void>;
  cancelCurrentProcess: () => void;
  _cleanupPolling: () => void;
  _applyPostProductionEffect: (prompt: string, loadingMsg: string) => Promise<void>;
  generateColorways: (colors: string[], incrementGenerationsUsed: (count: number) => void) => Promise<void>;
  generateAIBackground: (prompt: string) => Promise<void>;
}

export type SharedSlice = SharedState & SharedActions;

const initialSharedState: Omit<SharedState, 'BACKGROUNDS_LIBRARY'> = {
    studioMode: 'apparel',
    scene: {
        background: BACKGROUNDS_LIBRARY[1],
        lighting: LIGHTING_PRESETS[1],
        timeOfDay: null,
        sceneProps: '',
        environmentalEffects: '',
    },
    looks: [],
    aspectRatio: ASPECT_RATIOS_LIBRARY[0],
    styleReferenceImage: null,
    generatedImages: null,
    generatedVideoUrl: null,
    videoSourceImage: null,
    error: null,
    isGenerating: false,
    loadingMessage: '',
    isApplyingPost: false,
    numberOfImages: 1,
    activeImageIndex: null,
    isEditing: false,
    isApplyingEdit: false,
    imageBeingEdited: null,
    isBestPracticesModalOpen: false,
    isGuideActive: false,
    generationCount: 0,
    pollingIntervalRef: null,
    generationIdRef: 0,
    isGeneratingBackground: false,
    activeImageSources: null,
    showProcessingNotification: false,
    processingMessage: '',
    processingProgress: 0,
};

export const createSharedSlice: StudioStoreSlice<SharedSlice> = (set, get) => ({
    ...initialSharedState,
    BACKGROUNDS_LIBRARY,

    setStudioMode: (mode) => {
        const currentScene = get().scene;
        if (mode === 'product' && currentScene.lighting.isDynamic) {
            set({ scene: { ...currentScene, lighting: LIGHTING_PRESETS_PRODUCT[0] }});
        } else if (mode === 'apparel' || mode === 'reimagine') {
             set({ scene: { ...currentScene, lighting: LIGHTING_PRESETS[1] }});
        }
        if (mode === 'design') {
            set({ scene: { ...currentScene, lighting: LIGHTING_PRESETS_PRODUCT[0] }});
        }

        set({
            studioMode: mode,
            // Reset state from other modes
            apparel: [],
            uploadedModelImage: null,
            selectedModels: [],
            promptedModelDescription: '',
            productImage: null,
            productImageCutout: null,
            mockupImage: null,
            designImage: null,
            backDesignImage: null,
            reimagineSourcePhoto: null,
            // Reset generation artifacts
            generatedImages: null,
            generatedVideoUrl: null,
            videoSourceImage: null,
            activeImageIndex: null,
            artDirectorSuggestions: null,
            error: null,
        });
    },

    clearError: () => set({ error: null }),
    updateScene: (partialScene) => set(state => ({ scene: { ...state.scene, ...partialScene } })),

    setProcessingNotification: (show, message = '', progress = 0) => {
        set({
            showProcessingNotification: show,
            processingMessage: message,
            processingProgress: progress
        });
    },
    
    saveLook: (name) => {
      if (!name.trim()) return;
      const { apparelControls, scene } = get();
      const newLook: Look = {
        id: `look_${Date.now()}`,
        name: name.trim(),
        controls: { ...apparelControls },
        scene: { ...scene },
      };
      set(state => ({ looks: [...state.looks, newLook] }));
    },

    applyLook: (id) => {
      const look = get().looks.find(l => l.id === id);
      if (look) {
        get().updateScene(look.scene);
        set({ apparelControls: look.controls });
      }
    },

    deleteLook: (id) => {
      set(state => ({ looks: state.looks.filter(l => l.id !== id) }));
    },
    
    selectAspectRatio: (ar) => set({ aspectRatio: ar }),
    setStyleReferenceImage: (base64) => set({ styleReferenceImage: base64 }),
    setNumberOfImages: (count) => set({ numberOfImages: count }),
    setActiveImageIndex: (index) => {
        const imageSources = get().generatedImages?.[index ?? -1]?.sources;
        set({ activeImageIndex: index, activeImageSources: imageSources || null });
    },
    setBestPracticesModalOpen: (isOpen) => set({ isBestPracticesModalOpen: isOpen }),
    setGuideActive: (isActive) => set({ isGuideActive: isActive }),

    _cleanupPolling: () => {
        const { pollingIntervalRef } = get();
        if (pollingIntervalRef) {
            clearInterval(pollingIntervalRef);
            set({ pollingIntervalRef: null });
        }
    },

    cancelCurrentProcess: () => {
        set(state => ({ generationIdRef: state.generationIdRef + 1 }));
        get()._cleanupPolling();
        set({
            isGenerating: false,
            isApplyingPost: false,
            isApplyingEdit: false,
            error: "Process cancelled by user.",
        });
        console.log("Process cancelled by user.");
    },

    applyGenerativeEdit: async (maskBase64, prompt, apparelImageB64) => {
        const { activeImageIndex, generatedImages } = get();
        if (activeImageIndex === null || !generatedImages || !generatedImages[activeImageIndex]) {
            set({ error: "An error occurred: No image selected for editing." });
            return;
        }
        const sourceImage = generatedImages[activeImageIndex] as string;
        const processId = get().generationIdRef + 1;
        set({ generationIdRef: processId, isApplyingEdit: true, error: null });

        try {
            const newImageB64 = await geminiService.generativeEdit({
                originalImageB64: sourceImage,
                maskImageB64: maskBase64,
                prompt: prompt,
                apparelImageB64: apparelImageB64,
            });
            
            if (get().generationIdRef !== processId) return;
            
            if(newImageB64) {
                set(state => {
                    const newImages = [...(state.generatedImages || [])];
                    newImages[state.activeImageIndex!] = newImageB64;
                    return { generatedImages: newImages };
                });
            } else {
                throw new Error("Generative edit failed to return an image.");
            }
        } catch (e: any) {
            if (get().generationIdRef === processId) set({ error: e.message || "Failed to apply edit. Please try again." });
            console.error(e);
        } finally {
            if (get().generationIdRef === processId) set({ isApplyingEdit: false });
        }
    },
    
    startEditing: (index) => {
        const { generatedImages } = get();
        if (generatedImages && generatedImages[index]) {
            set({
                imageBeingEdited: { original: generatedImages[index] as string, index },
                activeImageIndex: index,
                isEditing: true,
            });
        }
    },
    
    cancelEditing: () => set({ isEditing: false, imageBeingEdited: null }),
    
    revertEdit: () => {
        set(state => {
            if (state.imageBeingEdited && state.generatedImages) {
                const newImages = [...state.generatedImages];
                newImages[state.imageBeingEdited.index] = state.imageBeingEdited.original;
                return { generatedImages: newImages };
            }
            return {};
        });
    },

    generateAsset: async (incrementGenerationsUsed) => {
        const { studioMode } = get();

        // --- Input Validation ---
        const stateForValidation = get();
        if (studioMode === 'apparel') {
            if (!stateForValidation.uploadedModelImage && stateForValidation.selectedModels.length === 0 && !stateForValidation.promptedModelDescription.trim()) {
                set({ error: "Please upload, select, or describe a model." }); return;
            }
            if (stateForValidation.apparel.length === 0) {
                set({ error: "Please upload at least one apparel item." }); return;
            }
        } else if (studioMode === 'product') {
            const imageForProductMode = stateForValidation.isCutout ? stateForValidation.productImageCutout : stateForValidation.productImage;
            if (!imageForProductMode) {
                set({ error: "Please upload a product image to generate a scene." }); return;
            }
        } else if (studioMode === 'design') {
             if (!stateForValidation.mockupImage || !stateForValidation.designImage) {
                set({ error: "Please upload a mockup and a design image." }); return;
            }
        } else if (studioMode === 'reimagine') {
            if (!stateForValidation.reimagineSourcePhoto) {
                set({ error: "Please upload a source photo to re-imagine." }); return;
            }
        }

        const currentGenerationId = get().generationIdRef + 1;
        set({ isGenerating: true, error: null, generatedImages: null, activeImageIndex: null, generatedVideoUrl: null, videoSourceImage: null, generationIdRef: currentGenerationId });

        try {
            let styleDescription: string | undefined;
            if (get().styleReferenceImage) {
                set({ loadingMessage: "Analyzing style reference..." });
                styleDescription = await geminiService.describeImageStyle(get().styleReferenceImage!).catch(e => {
                    console.warn("Could not analyze style reference image.", e); return undefined;
                });
            }

            if (get().generationIdRef !== currentGenerationId) return;
            
            const state = get() as StudioStore;
            let negativePrompt;
            switch(studioMode) {
                case 'apparel': negativePrompt = state.apparelControls.negativePrompt; break;
                case 'product': negativePrompt = state.productControls.negativePrompt; break;
                case 'reimagine': negativePrompt = state.reimagineControls.negativePrompt; break;
                default: negativePrompt = 'text, watermark, logo, person, human, hands';
            }

            // --- Generation Logic ---

            if (studioMode === 'reimagine') {
                const { parts } = promptService.generatePrompt({
                    ...state,
                    studioMode: 'reimagine',
                    styleDescription,
                    aspectRatio: state.aspectRatio.value,
                });
                set({
                    generatedImages: new Array(state.numberOfImages).fill(null),
                    activeImageIndex: null,
                    loadingMessage: `Re-imagining photo...`,
                });
                let completedCount = 0;
                await geminiService.generatePhotoshootImage(parts, state.aspectRatio.value, state.numberOfImages, negativePrompt, (imageB64, index) => {
                    if (get().generationIdRef !== currentGenerationId) return;
                    set(st => {
                        const newImages = [...st.generatedImages!];
                        newImages[index] = imageB64;
                        const firstNonNullIndex = newImages.findIndex(img => img !== null);
                        return { generatedImages: newImages, activeImageIndex: st.activeImageIndex === null ? firstNonNullIndex : st.activeImageIndex };
                    });
                    completedCount++;
                });

                if (get().generationIdRef !== currentGenerationId) return;
                if (completedCount === 0) throw new Error("Re-imagine generation failed to produce any results.");

                incrementGenerationsUsed(completedCount);
                set(st => ({ generationCount: st.generationCount + 1 }));

            } else if (studioMode === 'design') {
                const { designPlacementControls, backDesignImage, numberOfImages } = state;
                const isPackMode = designPlacementControls.isMockupPackActive;

                const shotsToGenerate = isPackMode
                    ? (backDesignImage ? MOCKUP_PACK_SHOTS_4 : MOCKUP_PACK_SHOTS_3)
                    : [{}]; // Placeholder for single mode
                
                const totalGenerations = isPackMode ? shotsToGenerate.length : numberOfImages;

                set({
                    generatedImages: new Array(totalGenerations).fill(null),
                    activeImageIndex: null,
                    loadingMessage: `Generating ${totalGenerations} mockup(s)...`
                });

                let completedCount = 0;
                const generationPromises = [];

                if (isPackMode) {
                    for (let i = 0; i < shotsToGenerate.length; i++) {
                        const shot = shotsToGenerate[i] as any;
                        const promise = (async () => {
                            if (get().generationIdRef !== currentGenerationId) return;

                            const tempControls = { ...designPlacementControls };
                            tempControls.cameraAngle = shot.angle;
                            tempControls.lightingStyle = shot.lighting;

                            const { parts } = promptService.generatePrompt({
                                ...state,
                                studioMode: 'design',
                                designPlacementControls: tempControls,
                                shotView: shot.view,
                                styleDescription,
                                aspectRatio: state.aspectRatio.value,
                            });
                            
                            await geminiService.generatePhotoshootImage(parts, state.aspectRatio.value, 1, negativePrompt, (imageB64, _index) => {
                                if (get().generationIdRef !== currentGenerationId) return;
                                set(st => {
                                    const newImages = [...st.generatedImages!];
                                    newImages[i] = imageB64;
                                    const firstNonNullIndex = newImages.findIndex(img => img !== null);
                                    return { generatedImages: newImages, activeImageIndex: st.activeImageIndex === null ? firstNonNullIndex : st.activeImageIndex };
                                });
                                completedCount++;
                            });
                        })();
                        generationPromises.push(promise);
                    }
                } else { // Single generation mode
                    const currentAngleId = designPlacementControls.cameraAngle;
                    const shotView: 'front' | 'back' = currentAngleId === 'back' ? 'back' : 'front';

                    const { parts } = promptService.generatePrompt({
                        ...state,
                        studioMode: 'design',
                        shotView: shotView,
                        styleDescription,
                        aspectRatio: state.aspectRatio.value,
                    });

                    const promise = geminiService.generatePhotoshootImage(parts, state.aspectRatio.value, totalGenerations, negativePrompt, (imageB64, index) => {
                        if (get().generationIdRef !== currentGenerationId) return;
                        set(st => {
                            const newImages = [...st.generatedImages!];
                            newImages[index] = imageB64;
                            const firstNonNullIndex = newImages.findIndex(img => img !== null);
                            return { generatedImages: newImages, activeImageIndex: st.activeImageIndex === null ? firstNonNullIndex : st.activeImageIndex };
                        });
                        completedCount++;
                    });
                    generationPromises.push(promise);
                }

                await Promise.allSettled(generationPromises);

                if (get().generationIdRef !== currentGenerationId) return;
                if (completedCount === 0) throw new Error("Mockup generation failed to produce any results.");
                
                incrementGenerationsUsed(completedCount);
                set(st => ({ generationCount: st.generationCount + 1 }));

            } else if (studioMode === 'product') {
                const imageForProductMode = state.isCutout ? state.productImageCutout : state.productImage;
                const { productEcommercePack } = state;
                const isPackMode = productEcommercePack !== 'none';

                const totalGenerations = isPackMode ? PRODUCT_ECOMMERCE_PACKS[productEcommercePack].shots.length : state.numberOfImages;

                set({ generatedImages: new Array(totalGenerations).fill(null), activeImageIndex: null, loadingMessage: `Generating ${totalGenerations} image(s)...` });
                let completedCount = 0;
                
                const allGenerationPromises = [];

                if (isPackMode) {
                    const packShots = PRODUCT_ECOMMERCE_PACKS[productEcommercePack].shots;
                    for (let i = 0; i < packShots.length; i++) {
                        const shotDef = packShots[i];
                        const promise = (async () => {
                            if (get().generationIdRef !== currentGenerationId) return;

                            const tempControls = { ...state.productControls };
                            tempControls.cameraAngle = CAMERA_ANGLES_LIBRARY_PRODUCT.find(c => c.id === shotDef.cameraAngleId) || tempControls.cameraAngle;
                            if (shotDef.focalLengthId) {
                                tempControls.focalLength = FOCAL_LENGTHS_LIBRARY.find(f => f.id === shotDef.focalLengthId) || tempControls.focalLength;
                            }
                            
                             const { parts } = promptService.generatePrompt({ 
                                ...state, studioMode: 'product',
                                productControls: tempControls,
                                generationMode: 'image',
                                productImage: imageForProductMode,
                                stagedAssets: state.stagedAssets,
                                styleDescription, aspectRatio: state.aspectRatio.value,
                            });

                             await geminiService.generatePhotoshootImage(parts, state.aspectRatio.value, 1, negativePrompt, (imageB64, _index) => {
                                if (get().generationIdRef !== currentGenerationId) return;
                                set(st => {
                                    const newImages = [...st.generatedImages!];
                                    newImages[i] = imageB64;
                                    const firstNonNullIndex = newImages.findIndex(img => img !== null);
                                    return { generatedImages: newImages, activeImageIndex: st.activeImageIndex === null ? firstNonNullIndex : st.activeImageIndex };
                                });
                                completedCount++;
                            });
                        })();
                        allGenerationPromises.push(promise);
                    }
                } else {
                     const { parts } = promptService.generatePrompt({ 
                        ...state, studioMode: 'product',
                        generationMode: 'image',
                        productImage: imageForProductMode,
                        stagedAssets: state.stagedAssets,
                        styleDescription, aspectRatio: state.aspectRatio.value,
                    });
                    
                    const promise = geminiService.generatePhotoshootImage(parts, state.aspectRatio.value, totalGenerations, negativePrompt, (imageB64, index) => {
                        if (get().generationIdRef !== currentGenerationId) return;
                        set(st => {
                            const newImages = [...st.generatedImages!];
                            newImages[index] = imageB64;
                            const firstNonNullIndex = newImages.findIndex(img => img !== null);
                            return { generatedImages: newImages, activeImageIndex: st.activeImageIndex === null ? firstNonNullIndex : st.activeImageIndex };
                        });
                        completedCount++;
                    });
                    allGenerationPromises.push(promise);
                }

                await Promise.allSettled(allGenerationPromises);

                if (get().generationIdRef !== currentGenerationId) return;
                if (completedCount === 0) throw new Error("Image generation failed to produce any results.");
                
                incrementGenerationsUsed(completedCount);
                set(st => ({ generationCount: st.generationCount + 1 }));

            } else { // Apparel mode
                const modelsToProcess = (state.uploadedModelImage || state.promptedModelDescription.trim()) ? [null] : state.selectedModels;
                
                let packShotsToUse = state.ecommercePack !== 'none' ? ECOMMERCE_PACKS[state.ecommercePack].shots : [];
                let dynamicShotTypes: ShotType[] | null = null;

                if (state.ecommercePack === 'pov') {
                    set({ loadingMessage: "AI director is brainstorming POV shots..." });
                    try {
                        const dynamicPoses = await geminiService.generateDynamicPOVShots();
                        dynamicShotTypes = dynamicPoses.map((pose, index) => ({
                            id: `dynamic-pov-${currentGenerationId}-${index}`,
                            name: pose.name,
                            description: pose.description,
                            category: 'Creative'
                        }));
                        packShotsToUse = dynamicShotTypes.map(shot => ({
                            shotId: shot.id,
                            expressionId: 'e6', // Use 'playful' for dynamic POV shots
                            name: shot.name
                        }));
                    } catch (e) {
                        console.error("Failed to generate dynamic POV shots, falling back to static ones.", e);
                        // On failure, the original packShotsToUse will be used.
                    }
                }

                let totalGenerations = 0;
                if (state.isSocialMediaPack) {
                    totalGenerations = modelsToProcess.length * 4;
                } else if (state.ecommercePack !== 'none') {
                    totalGenerations = modelsToProcess.length * packShotsToUse.length;
                } else {
                    totalGenerations = modelsToProcess.length * state.numberOfImages;
                }

                set({ generatedImages: new Array(totalGenerations).fill(null), activeImageIndex: null, loadingMessage: `Generating ${totalGenerations} image(s)...` });
                let completedCount = 0;
                
                const hasTop = state.apparel.some(item => item.category === 'Top' || item.category === 'Outerwear' || item.category === 'Full Body');
                const hasBottom = state.apparel.some(item => item.category === 'Bottom' || item.category === 'Full Body');
                const isIncompleteOutfit = (hasTop && !hasBottom) || (!hasTop && hasBottom);
                const isPackGeneration = state.isSocialMediaPack || state.ecommercePack !== 'none';
                let baseLookImageB64: string | null = null;

                if (isIncompleteOutfit && isPackGeneration) {
                    set({ loadingMessage: "Generating consistent base outfit..." });

                    const baseLookControls = { ...state.apparelControls, shotType: SHOT_TYPES_LIBRARY.find(s => s.id === 'st1')!, expression: EXPRESSIONS.find(e => e.id === 'e1')!, cameraAngle: CAMERA_ANGLES_LIBRARY.find(c => c.id === 'ca1')! };
                    const baseLookScene = { ...state.scene, background: BACKGROUNDS_LIBRARY.find(b => b.id === 'b2')! };
                    const modelForBaseLook = modelsToProcess[0];
                    const modelImageForBaseLook = modelForBaseLook?.source === 'user-saved' ? modelForBaseLook.thumbnail : modelForBaseLook ? await urlToBase64(modelForBaseLook.thumbnail) : state.uploadedModelImage;

                    const { parts: baseLookParts } = promptService.generatePrompt({ ...state, studioMode: 'apparel', generationMode: 'image', apparelControls: baseLookControls, scene: baseLookScene, uploadedModelImage: modelImageForBaseLook, selectedModel: modelForBaseLook, aspectRatio: '3:4', styleDescription });
                    
                    await new Promise<void>((resolve, reject) => {
                        geminiService.generatePhotoshootImage(baseLookParts, '3:4', 1, negativePrompt, (imageB64, _index) => {
                            baseLookImageB64 = imageB64;
                            resolve();
                        }).catch(reject);
                    });

                    if (!baseLookImageB64) throw new Error("Failed to generate the base outfit for pack consistency.");
                    if (get().generationIdRef !== currentGenerationId) return;
                }


                const allGenerationPromises = modelsToProcess.map(async (model, modelIndex) => {
                    const modelImageForPrompt = model?.source === 'user-saved' 
                        ? model.thumbnail
                        : model 
                            ? await urlToBase64(model.thumbnail) 
                            : state.uploadedModelImage;

                    const onImageGenerated = (imageB64: string, resultIndex: number, packIndex?: number) => {
                        if (get().generationIdRef !== currentGenerationId) return;
                        
                        let finalIndex;
                        if (state.isSocialMediaPack) {
                            finalIndex = modelIndex * 4 + (packIndex! * 2) + resultIndex;
                        } else if (state.ecommercePack !== 'none') {
                            const packSize = packShotsToUse.length;
                            finalIndex = modelIndex * packSize + packIndex!;
                        } else {
                            finalIndex = modelIndex * state.numberOfImages + resultIndex;
                        }

                        set(st => {
                            const newImages = [...st.generatedImages!];
                            newImages[finalIndex] = imageB64;
                            const firstNonNullIndex = newImages.findIndex(img => img !== null);
                            return { generatedImages: newImages, activeImageIndex: st.activeImageIndex === null ? firstNonNullIndex : st.activeImageIndex };
                        });
                        completedCount++;
                    };

                    if (state.isSocialMediaPack) {
                        const socialMediaRatios: AspectRatio['value'][] = ['1:1', '9:16'];
                        const shotTypes = SHOT_TYPES_LIBRARY.filter(st => SOCIAL_MEDIA_PACK_SHOT_IDS.includes(st.id));
                         for (const [shotIndex, shotType] of shotTypes.entries()) {
                            const { parts } = promptService.generatePrompt({ ...state, studioMode: 'apparel', generationMode: 'image', styleDescription, uploadedModelImage: baseLookImageB64 ? null : modelImageForPrompt, selectedModel: model, promptedModelDescription: '', apparelControls: { ...state.apparelControls, shotType }, aspectRatio: '1:1', baseLookImageB64, apparel: baseLookImageB64 ? [] : state.apparel });
                            await geminiService.generatePhotoshootImage(parts, '1:1', socialMediaRatios.length, negativePrompt, (img, ratioIndex) => onImageGenerated(img, ratioIndex, shotIndex));
                        }
                    } else if (state.ecommercePack !== 'none') {
                        const packShots = packShotsToUse;
                        for (const [shotIndex, shotDef] of packShots.entries()) {
                            const packshotType = (dynamicShotTypes && dynamicShotTypes.find(st => st.id === shotDef.shotId)) || SHOT_TYPES_LIBRARY.find(st => st.id === shotDef.shotId)!;
                            const packshotExpr = EXPRESSIONS.find(e => e.id === shotDef.expressionId)!;
                            const packshotAngle = CAMERA_ANGLES_LIBRARY.find(ca => ca.id === shotDef.cameraAngleId) || state.apparelControls.cameraAngle;
                            const { parts } = promptService.generatePrompt({ ...state, studioMode: 'apparel', generationMode: 'image', styleDescription, uploadedModelImage: baseLookImageB64 ? null : modelImageForPrompt, selectedModel: model, promptedModelDescription: '', apparelControls: { ...state.apparelControls, shotType: packshotType, expression: packshotExpr, cameraAngle: packshotAngle }, aspectRatio: state.aspectRatio.value, baseLookImageB64, apparel: baseLookImageB64 ? [] : state.apparel });
                            await geminiService.generatePhotoshootImage(parts, state.aspectRatio.value, 1, negativePrompt, (img, i) => onImageGenerated(img, i, shotIndex));
                        }
                    } else {
                        const { parts } = promptService.generatePrompt({ ...state, studioMode: 'apparel', generationMode: 'image', styleDescription, uploadedModelImage: modelImageForPrompt, selectedModel: model, aspectRatio: state.aspectRatio.value });
                        await geminiService.generatePhotoshootImage(parts, state.aspectRatio.value, state.numberOfImages, negativePrompt, onImageGenerated);
                    }
                });

                await Promise.allSettled(allGenerationPromises);
                
                if (get().generationIdRef !== currentGenerationId) return;
                if (completedCount === 0) throw new Error("Image generation failed for all tasks.");
                if (completedCount < totalGenerations) set({error: `${totalGenerations - completedCount} generation tasks failed.`})

                incrementGenerationsUsed(completedCount + (baseLookImageB64 ? 1 : 0));
                set(st => ({ generationCount: st.generationCount + 1 }));
            }
        } catch (e: any) {
            if (get().generationIdRef === currentGenerationId) {
                set({ error: e.message || "Generation failed.", isGenerating: false });
                console.error(e); get()._cleanupPolling();
            }
        } finally {
            if (get().generationIdRef === currentGenerationId) {
                set({ isGenerating: false });
            }
        }
    },

    generateVideoFromImage: async (animation, incrementGenerationsUsed) => {
        const state = get() as StudioStore;
        const { activeImageIndex, generatedImages } = state;

        if (activeImageIndex === null || !generatedImages || !generatedImages[activeImageIndex]) {
            set({ error: "Please select a generated image to animate." });
            return;
        }

        const imageToAnimate = generatedImages[activeImageIndex]!;

        const currentGenerationId = get().generationIdRef + 1;
        set({ isGenerating: true, error: null, generatedVideoUrl: null, videoSourceImage: imageToAnimate, generationIdRef: currentGenerationId });

        try {
            let styleDescription: string | undefined;
            if (state.styleReferenceImage) {
                set({ loadingMessage: "Analyzing style reference..." });
                styleDescription = await geminiService.describeImageStyle(state.styleReferenceImage).catch(e => {
                    console.warn("Could not analyze style reference image.", e); return undefined;
                });
            }

            if (get().generationIdRef !== currentGenerationId) return;

            const { parts } = promptService.generatePrompt({
                ...state,
                studioMode: 'apparel',
                generationMode: 'video', // Specify video mode for prompt
                animation: animation,    // Pass the selected animation
                styleDescription,
                // Use the generated image's model context, not the initial state
                uploadedModelImage: imageToAnimate, 
                selectedModel: null, 
                promptedModelDescription: '', 
                aspectRatio: state.aspectRatio.value
            });

            const textPart = parts.find(p => 'text' in p);
            if (!textPart) throw new Error("Cannot generate video without a text prompt.");
            
            let messageIndex = 0; 
            set({ loadingMessage: VIDEO_LOADING_MESSAGES[messageIndex] });
            
            let operation = await geminiService.generatePhotoshootVideo(textPart.text, imageToAnimate);
            
            const intervalId = window.setInterval(async () => {
                if (get().generationIdRef !== currentGenerationId) return get()._cleanupPolling();
                messageIndex = (messageIndex + 1) % VIDEO_LOADING_MESSAGES.length;
                set({ loadingMessage: VIDEO_LOADING_MESSAGES[messageIndex] });
                try {
                    operation = await geminiService.getVideoOperationStatus(operation);
                    if (operation.done) {
                        get()._cleanupPolling();
                        if (get().generationIdRef !== currentGenerationId) return;
                        set({ loadingMessage: "Finalizing video..." });
                        const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
                        if (uri) {
                            const blobUrl = await geminiService.fetchVideoAsBlobUrl(uri);
                            if (get().generationIdRef === currentGenerationId) {
                                set({ generatedVideoUrl: blobUrl, isGenerating: false, activeImageIndex: null });
                                incrementGenerationsUsed(1); // Assuming video costs 1 generation credit
                            }
                        } else throw new Error("Video generation finished but no URI was returned.");
                    }
                } catch (e) {
                    if (get().generationIdRef === currentGenerationId) set({ error: "Error checking video status." });
                    console.error(e); get()._cleanupPolling(); set({ isGenerating: false });
                }
            }, 10000);
            set({ pollingIntervalRef: intervalId });

        } catch (e: any) {
            if (get().generationIdRef === currentGenerationId) {
                set({ error: e.message || "Video generation failed.", isGenerating: false, videoSourceImage: null });
                console.error(e); get()._cleanupPolling();
            }
        }
    },

    generateAIBackground: async (prompt) => {
        if (!prompt.trim()) return;
        set({ isGeneratingBackground: true, error: null });
        try {
          const { aspectRatio } = get();
          // Use the currently selected aspect ratio for the background
          const imageB64 = await geminiService.generateWithImagen(prompt, aspectRatio.value);
          if (imageB64) {
            const customBg: Background = {
                id: 'custom',
                name: 'AI Generated BG',
                type: 'image',
                value: imageB64,
                category: 'Custom'
            };
            get().updateScene({ background: customBg });
          }
        } catch (e: any) {
          console.error("Failed to generate AI background:", e);
          set({ error: "AI Background generation failed. Please try again." });
        } finally {
          set({ isGeneratingBackground: false });
        }
    },

    generateColorways: async (colors, incrementGenerationsUsed) => {
        const { studioMode, mockupImage, designImage } = get();
        if (studioMode !== 'design' || !mockupImage || !designImage || colors.length === 0) {
            set({ error: "Please upload a mockup, a design, and specify colors to generate colorways." });
            return;
        }

        const currentGenerationId = get().generationIdRef + 1;
        set({ 
            isGenerating: true, 
            error: null, 
            generatedImages: new Array(colors.length).fill(null), // Set up placeholders
            activeImageIndex: null, 
            generatedVideoUrl: null, 
            videoSourceImage: null,
            generationIdRef: currentGenerationId,
            loadingMessage: `Generating ${colors.length} colorways...`,
        });

        let completedCount = 0;
        const generationPromises = colors.map((color, index) => {
            return (async () => {
                if (get().generationIdRef !== currentGenerationId) return;

                const stateForPrompt = JSON.parse(JSON.stringify(get()));
                stateForPrompt.designPlacementControls.shirtColor = color;
                
                const { parts } = promptService.generatePrompt({
                    ...stateForPrompt,
                    studioMode: 'design',
                    shotView: 'front'
                });

                await geminiService.generatePhotoshootImage(parts, stateForPrompt.aspectRatio.value, 1, undefined, (imageB64, _resultIndex) => {
                    if (get().generationIdRef !== currentGenerationId) return;
                    
                    set(st => {
                        const newImages = [...st.generatedImages!];
                        newImages[index] = imageB64;
                        const firstNonNullIndex = newImages.findIndex(img => img !== null);
                        return { 
                            generatedImages: newImages, 
                            activeImageIndex: st.activeImageIndex === null ? firstNonNullIndex : st.activeImageIndex 
                        };
                    });
                    completedCount++;
                });
            })();
        });

        try {
            await Promise.allSettled(generationPromises);
            
            if (get().generationIdRef !== currentGenerationId) return;

            if (completedCount === 0) {
                throw new Error("Colorway generation failed to produce any results.");
            }
            if (completedCount < colors.length) {
                set({ error: `${colors.length - completedCount} colorways failed to generate.` });
            }

            incrementGenerationsUsed(completedCount);
            set(st => ({ generationCount: st.generationCount + 1 }));

        } catch (e: any) {
            if (get().generationIdRef === currentGenerationId) {
                set({ error: e.message || "Colorway generation failed." });
                console.error(e);
            }
        } finally {
            if (get().generationIdRef === currentGenerationId) {
                set({ isGenerating: false, loadingMessage: '' });
            }
        }
    },
    
    _applyPostProductionEffect: async (prompt, loadingMsg) => {
        const { generatedImages, activeImageIndex, aspectRatio, generationIdRef } = get();
        const activeImage = (generatedImages && activeImageIndex !== null) ? generatedImages[activeImageIndex] : null;
        if (!activeImage) {
            set({ error: "Please generate and select an image first." });
            return;
        }
        const processId = generationIdRef + 1;
        set({ isApplyingPost: true, error: null, loadingMessage: loadingMsg, generationIdRef: processId });

        try {
            const { mimeType, data } = geminiService.parseDataUrl(activeImage);
            const parts = [{ text: prompt }, { inlineData: { mimeType, data } }];
            
            await geminiService.generatePhotoshootImage(parts, aspectRatio.value, 1, undefined, (newImageB64) => {
                if (get().generationIdRef !== processId) return;
                 set(state => {
                    const updatedImages = [...(state.generatedImages || [])];
                    updatedImages[state.activeImageIndex!] = newImageB64;
                    return { generatedImages: updatedImages };
                });
            });

        } catch (e) {
            if (get().generationIdRef === processId) set({ error: "Failed to apply effect." });
            console.error(e);
        } finally {
            if (get().generationIdRef === processId) set({ isApplyingPost: false, loadingMessage: '' });
        }
    },

    applyColorGrade: async (grade) => {
        const prompt = `**POST-PRODUCTION TASK: COLOR GRADING**
- **GOAL:** Apply a stylistic color grade: ${grade.name}.
- **STYLE DESCRIPTION:** ${grade.description}.
- **CRITICAL INSTRUCTION:** Do NOT change the subject, composition, clothing, or any other element. ONLY modify the overall color and tone.`;
        await get()._applyPostProductionEffect(prompt, `Applying ${grade.name} grade...`);
    },

    applyRealismBoost: async () => {
        const prompt = `**POST-PRODUCTION TASK: REALISM BOOST**
- **GOAL:** Subtly enhance photorealism.
- **ACTIONS:** Increase sharpness, refine micro-details (skin texture, fabric weave), correct minor AI artifacts.
- **CRITICAL INSTRUCTION:** Do NOT change the subject, composition, clothing, or color grade. Changes must be a subtle enhancement.`;
        await get()._applyPostProductionEffect(prompt, `Applying Realism Boost...`);
    },

    applyFilmGrain: async (strength) => {
        const grainDescription = strength === 'Subtle' ? "subtle, fine film grain (35mm film stock)." : "noticeable, artistic medium film grain (16mm film stock).";
        const prompt = `**POST-PRODUCTION TASK: FILM GRAIN**
- **GOAL:** Apply realistic film grain.
- **STYLE:** ${grainDescription}
- **CRITICAL INSTRUCTION:** Do NOT change the subject, composition, clothing, or color. ONLY add the film grain texture.`;
        await get()._applyPostProductionEffect(prompt, `Applying ${strength} Film Grain...`);
    },
    
    applyHologramEffect: async () => {
        const prompt = `**POST-PRODUCTION TASK: HOLOGRAPHIC TRANSFORMATION**
- **GOAL:** Transform the primary subject of the image into a 3D transparent line art hologram.
- **STYLE:** The hologram should be glowing, ethereal, and appear to be projected in the space. It should be composed of clean, luminous lines.
- **CRITICAL INSTRUCTION:** Do NOT change the background or composition. Only transform the subject itself.`;
        await get()._applyPostProductionEffect(prompt, `Applying Hologram Effect...`);
    },
});
