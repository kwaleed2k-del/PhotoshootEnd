import type { AIModel, ApparelItem, Scene, GenerationMode, Animation, AspectRatio, ApparelCreativeControls, ProductCreativeControls, DesignPlacementControls, DesignInput, StagedAsset, ReimagineCreativeControls } from '../types';
import { FABRIC_STYLE_OPTIONS, MOCKUP_STYLE_OPTIONS, DESIGN_LIGHTING_STYLE_OPTIONS, DESIGN_CAMERA_ANGLE_OPTIONS, PRINT_STYLE_OPTIONS, DESIGN_PLACEMENT_OPTIONS } from '../constants';

interface BasePromptParams {
    styleDescription?: string;
    aspectRatio: AspectRatio['value'];
}

interface ApparelPromptParams extends BasePromptParams {
    studioMode: 'apparel';
    uploadedModelImage: string | null;
    selectedModel: AIModel | null;
    apparel: ApparelItem[];
    scene: Scene;
    animation?: Animation;
    generationMode: GenerationMode;
    promptedModelDescription: string;
    modelLightingDescription: string | null;
    apparelControls: ApparelCreativeControls;
    baseLookImageB64?: string | null;
}

interface ProductPromptParams extends BasePromptParams {
    studioMode: 'product';
    productImage: string | null;
    stagedAssets: StagedAsset[];
    scene: Scene;
    generationMode: GenerationMode;
    productControls: ProductCreativeControls;
}

interface DesignPromptParams extends BasePromptParams {
    studioMode: 'design';
    mockupImage: DesignInput;
    designImage: DesignInput;
    backDesignImage: DesignInput | null;
    designPlacementControls: DesignPlacementControls;
    scene: Scene;
    shotView: 'front' | 'back';
}

interface ReimaginePromptParams extends BasePromptParams {
    studioMode: 'reimagine';
    reimagineSourcePhoto: string;
    newModelPhoto: string | null;
    reimagineControls: ReimagineCreativeControls;
}


type PromptGenerationParams = ApparelPromptParams | ProductPromptParams | DesignPromptParams | ReimaginePromptParams;


const parseDataUrl = (dataUrl: string) => {
    const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
    if (!match) {
        throw new Error("Invalid data URL");
    }
    return {
        mimeType: match[1],
        data: match[2],
    };
};

export const promptService = {
    generatePrompt: (params: PromptGenerationParams): { parts: any[] } => {
        const parts: any[] = [];
        
        // ===================================
        // --- RE-IMAGINE MODE PROMPT LOGIC ---
        // ===================================
        if (params.studioMode === 'reimagine') {
            const { reimagineSourcePhoto, newModelPhoto, reimagineControls, aspectRatio, styleDescription } = params;
            const { newModelDescription, newBackgroundDescription } = reimagineControls;

            if (!newModelPhoto && !newModelDescription.trim() && !newBackgroundDescription.trim()) {
                throw new Error("Please describe or upload a new model, or describe a new background.");
            }

            let textPrompt = `**PHOTO RE-IMAGINE DIRECTIVE**

**PRIMARY GOAL:** You are an expert photo editor. You are provided with a source image and other assets. Your mission is to generate a new, photorealistic image by editing the source image according to the instructions below.

**NON-NEGOTIABLE CORE RULE:** You MUST preserve the **exact outfit** (all clothing items, colors, and styles) and the **exact pose** of the person from the source image. This is the highest priority.

---
**1. ASSET ANALYSIS (CRITICAL)**
- **FIRST IMAGE (SOURCE PHOTO):** This is the source of truth for the **OUTFIT** and **POSE**.
${newModelPhoto ? '- **SECOND IMAGE (NEW MODEL REFERENCE):** This is the source of truth for the new person\'s **FACE and IDENTITY**.\n' : ''}
---
**2. EDITING INSTRUCTIONS**
`;

            if (newModelPhoto) {
                textPrompt += `- **MODEL SWAP BY PHOTO (CRITICAL):** Replace the person in the SOURCE PHOTO with the person from the NEW MODEL REFERENCE. You must transfer the face and identity from the NEW MODEL REFERENCE with perfect accuracy. The new person MUST be in the exact same pose and be wearing the exact same outfit as the person in the SOURCE PHOTO.\n`;
                if (newModelDescription.trim()) {
                     textPrompt += `- **MODEL STYLING (GUIDANCE):** After swapping the model, apply this additional styling guidance: "${newModelDescription.trim()}".\n`;
                }
            } else if (newModelDescription.trim()) {
                textPrompt += `- **MODEL SWAP BY DESCRIPTION (CRITICAL):** Replace the person in the source image with a new person who perfectly matches this description: "${newModelDescription.trim()}". The new person MUST be in the exact same pose and be wearing the exact same outfit as the person in the original image.\n`;
            } else {
                textPrompt += `- **MODEL PRESERVATION:** The person from the source image should be preserved with 100% accuracy.\n`;
            }

            if (newBackgroundDescription.trim()) {
                textPrompt += `- **BACKGROUND SWAP (CRITICAL):** Replace the background of the source image with a new, photorealistic scene that perfectly matches this description: "${newBackgroundDescription.trim()}". The person, their pose, and their outfit must be seamlessly integrated into this new background with realistic lighting and shadows.\n`;
            } else {
                textPrompt += `- **BACKGROUND PRESERVATION:** The background from the source image should be preserved.\n`;
            }

            textPrompt += `
---
**3. FINAL IMAGE STYLE & QUALITY**
- **ASPECT RATIO (CRITICAL):** The final image output MUST have an aspect ratio of exactly ${aspectRatio}.
- **QUALITY:** This is a professional photoshoot. The final output must be an ultra-high-quality, hyperrealistic, and tack-sharp photograph.
${styleDescription ? `- **STYLISTIC GOAL:** The final image must match the artistic style described as: "${styleDescription}".\n` : ''}`;

            parts.push({ text: textPrompt });
            
            // Add source photo first
            const { mimeType: sourceMime, data: sourceData } = parseDataUrl(reimagineSourcePhoto);
            parts.push({ inlineData: { mimeType: sourceMime, data: sourceData } });
            
            // Add new model photo if it exists
            if (newModelPhoto) {
                 const { mimeType: modelMime, data: modelData } = parseDataUrl(newModelPhoto);
                 parts.push({ inlineData: { mimeType: modelMime, data: modelData } });
            }

            return { parts };
        }
        
        // =======================================================
        // --- APPAREL MODE - CONSISTENT PACK GENERATION LOGIC ---
        // =======================================================
        if (params.studioMode === 'apparel' && params.baseLookImageB64) {
            const { baseLookImageB64, scene, apparelControls, aspectRatio, styleDescription } = params;
            const {
                shotType, expression, aperture, focalLength, fabric, cameraAngle,
                lightingDirection, lightQuality, catchlightStyle, isHyperRealismEnabled,
                cinematicLook, styleStrength, colorGrade, hairStyle, makeupStyle, garmentStyling
            } = apparelControls;

            let textPrompt = `**MASTER RE-POSE DIRECTIVE**

**PRIMARY GOAL:** You are provided with a reference image of a model wearing a complete outfit. Your critical mission is to generate a new photograph of the *same model* wearing the *exact same outfit*, but with a new pose and in a new scene as described below.

**NON-NEGOTIABLE RULES:**
1.  **IDENTITY & OUTFIT PRESERVATION:** Replicate the model's identity (face, body, hair) and the entire outfit (all clothing, colors, textures) from the reference image with 100% accuracy. Do NOT change the clothing.
2.  **SETTINGS ARE LAW:** You MUST follow the new POSE, SCENE, and CAMERA instructions below. These settings override the pose and scene from the reference image.

---
**1. MODEL & OUTFIT (Source: First Image)**
- **MISSION:** Use the provided image as the definitive source for the model's appearance and their complete wardrobe.

---
`;
            // POSE & STYLING
            textPrompt += `**2. POSE & STYLING (Source: User Settings)**
- **POSE (Body Language):** The model must be positioned exactly as described: ${shotType.description}.
- **EXPRESSION:** The model's facial expression must be: ${expression.description}.
`;
            if (hairStyle.trim()) textPrompt += `- **HAIR:** The model's hair is styled as: "${hairStyle.trim()}".\n`;
            if (makeupStyle.trim()) textPrompt += `- **MAKEUP:** The model's makeup is a "${makeupStyle.trim()}" look.\n`;
            if (garmentStyling.trim()) textPrompt += `- **GARMENT STYLING:** The clothing should be styled as follows: ${garmentStyling.trim()}.\n`;
            if (fabric.id !== 'fab1') textPrompt += `- **FABRIC TEXTURE:** The primary garment(s) should have the texture of ${fabric.description}\n`;
            textPrompt += '\n';

            // SCENE & LIGHTING
            const isCustomBackground = scene.background.id === 'custom' && scene.background.type === 'image';
            const backgroundPrompt = isCustomBackground
                ? `in the environment depicted in the FINAL image provided`
                : scene.background.type === 'image' ? `in a photorealistic ${scene.background.name}` : `against a simple studio background with a ${scene.background.name.toLowerCase()} color.`;
            
            let lightingPrompt = `Apply ${scene.lighting.description}.`;
            if (lightingDirection.id !== 'ld1') lightingPrompt += ` The main light source is positioned ${lightingDirection.description}.`;
            if (lightQuality.id !== 'lq1') lightingPrompt += ` The light quality is ${lightQuality.description}.`;
            lightingPrompt += ` The final image should feature ${catchlightStyle.description}.`;
            lightingPrompt += ' The model, apparel, and background must all be lit from the same light source and direction to create a cohesive and realistic photograph.';

            textPrompt += `**3. SCENE & LIGHTING (Source: User Settings)**
- **BACKGROUND:** The scene is set ${backgroundPrompt}.
- **LIGHTING (CRITICAL):** ${lightingPrompt}
`;
            if(scene.sceneProps.trim()) textPrompt += `- **PROPS:** The scene must include: ${scene.sceneProps.trim()}.\n`;
            if(scene.environmentalEffects.trim()) textPrompt += `- **EFFECTS:** The scene should have these atmospheric effects: ${scene.environmentalEffects.trim()}.\n`;
            textPrompt += '\n';

            // CAMERA & LENS
            textPrompt += `**4. CAMERA & LENS (Source: User Settings)**
- **CAMERA ANGLE:** ${cameraAngle.description}.
- **APERTURE:** ${aperture.description}.
- **FOCAL LENGTH:** ${focalLength.description}.
\n`;

            // FINAL IMAGE STYLE & QUALITY
            textPrompt += `**5. FINAL IMAGE STYLE & QUALITY (Source: User Settings)**
- **ASPECT RATIO (CRITICAL):** The final image output MUST have an aspect ratio of exactly ${aspectRatio}.
- **QUALITY:** This is a professional photoshoot. The final output must be an ultra-high-quality, hyperrealistic, and tack-sharp photograph.
`;
            if (styleDescription) textPrompt += `- **STYLISTIC GOAL:** The final image must match the artistic style described as: "${styleDescription}". Apply this style with an influence of approximately ${styleStrength}%.\n`;
            if (colorGrade.id !== 'cg_none') textPrompt += `- **COLOR GRADE:** Apply a professional color grade with the following style: ${colorGrade.description}\n`;
            if (cinematicLook) textPrompt += `**CINEMATIC LOOK (ENABLED):** The image must have a cinematic quality, emulating a still from a high-budget film with fine, realistic film grain.\n`;
            if (isHyperRealismEnabled) textPrompt += `**HYPER-REALISM MODE (ENABLED):** Pay extreme attention to micro-details like skin pores, fabric weave, and ensure all anatomy is 100% accurate.\n`;
            
            parts.push({ text: textPrompt });
            const { mimeType, data } = parseDataUrl(baseLookImageB64);
            parts.push({ inlineData: { mimeType, data } });

            if (isCustomBackground) {
                 const { mimeType, data } = parseDataUrl(scene.background.value);
                 parts.push({ inlineData: { mimeType, data } });
            }

            return { parts };
        }

        // ===================================
        // --- DESIGN MODE PROMPT LOGIC ---
        // ===================================
        if (params.studioMode === 'design') {
            const { mockupImage, designImage, backDesignImage, designPlacementControls, scene, aspectRatio, styleDescription, shotView } = params;
            
            const activeDesignImage = (shotView === 'back' && backDesignImage) ? backDesignImage : designImage;
            const activePlacementControls = shotView === 'back' ? designPlacementControls.back : designPlacementControls.front;

            // Get text descriptions from IDs
            const fabricStyle = FABRIC_STYLE_OPTIONS.find(f => f.id === designPlacementControls.fabricStyle)?.name || 'standard cotton';
            const mockupStyle = MOCKUP_STYLE_OPTIONS.find(m => m.id === designPlacementControls.mockupStyle)?.name || 'hanging';
            const lightingStyle = DESIGN_LIGHTING_STYLE_OPTIONS.find(l => l.id === designPlacementControls.lightingStyle)?.name || 'studio softbox lighting';
            const cameraAngleOption = DESIGN_CAMERA_ANGLE_OPTIONS.find(c => c.id === designPlacementControls.cameraAngle);
            const printStyle = PRINT_STYLE_OPTIONS.find(p => p.id === designPlacementControls.printStyle)?.name || 'screen printed';

            let cameraAnglePrompt = `The photograph is shot from a ${cameraAngleOption?.name || 'eye-level front view'}.`;
            if (designPlacementControls.cameraAngle === 'detail') {
                 cameraAnglePrompt = `**CAMERA ANGLE (CRITICAL DETAIL SHOT):** The photograph is an extreme close-up, tightly framed *only* on the design area. The design should fill most of the frame. Show the intricate details of the "${printStyle}" print style on the fabric texture.`;
            } else if (shotView === 'back') {
                 cameraAnglePrompt += ' This is a view of the BACK of the garment.';
            }

            let mockupAndMaterialPrompt = `**MOCKUP & MATERIAL (Based on the FIRST reference image):**
- **Apparel Style (CRITICAL):** The final image must represent a garment that perfectly matches this detailed description: "${designPlacementControls.apparelType}". This description defines the complete look, including the cut, style, and any color patterns (like color blocking).
- **Base Color:** The garment's primary color should be this hex code: ${designPlacementControls.shirtColor}. However, the text description above is the priority and overrides this color if specific colors or patterns are mentioned.
- **Fabric Type:** The garment must look like it's made of ${fabricStyle}. Pay attention to the texture and weight.
- **Presentation Style:** The garment should be presented in a professional ${mockupStyle} style.`;

            if (shotView === 'back') {
                mockupAndMaterialPrompt += `
- **VIEWPOINT (MANDATORY):** You are generating a photograph of the **BACK** of the garment. The provided MOCKUP image is a reference for the garment's general style, color, and material ONLY. You must creatively render the back view of this garment based on the front view provided.`;
            } else {
                mockupAndMaterialPrompt += `
- The overall shape, fit, and wrinkles should be inspired by the provided MOCKUP image.`;
            }
            
            const { placement, scale, rotation, offsetX, offsetY } = activePlacementControls;
            const placementName = DESIGN_PLACEMENT_OPTIONS.find(p => p.id === placement)?.name || 'center';

            let sizeDescriptor = '';
            if (scale < 20) {
                sizeDescriptor = 'very small, like a tag-sized logo (approx 1-2 inches wide)';
            } else if (scale < 40) {
                sizeDescriptor = 'small, like a standard chest logo (approx. 3-4 inches wide)';
            } else if (scale < 70) {
                sizeDescriptor = 'medium, as a standard graphic for the front of a t-shirt (approx. 8-10 inches wide)';
            } else if (scale < 100) {
                sizeDescriptor = 'large, covering a significant portion of the chest area (approx. 11-12 inches wide)';
            } else {
                sizeDescriptor = 'extra-large, as an oversized or full-front print covering most of the printable area of the garment';
            }

            let designAndPlacementPrompt = `**DESIGN & PLACEMENT (Based on the SECOND reference image):**`;
            if (shotView === 'back') {
                designAndPlacementPrompt += `
- **Design Application (CRITICAL BACK VIEW):** The artwork provided in the DESIGN image is the **BACK PRINT**. You MUST place this design on the **BACK** of the garment you are generating. Do not place this design on the front.`;
            } else {
                designAndPlacementPrompt += `
- **Design Application (FRONT VIEW):** Take the artwork from the DESIGN image and place it on the **FRONT** of the garment.`;
            }
            designAndPlacementPrompt += `
- **Print Style:** The design should look like it was applied using a "${printStyle}" method. It needs to have the correct texture and finish (e.g., flat for screen print, textured for embroidery).
- **Placement (CRITICAL):** The design must be placed on the **${shotView}** of the garment, centered on the **${placementName}** area.
- **Size (CRITICAL):** The final printed size of the design on the garment must be **${sizeDescriptor}**. The provided DESIGN image should be scaled appropriately to achieve this size.
- **Fine-Tuning Adjustments (Apply AFTER placement and sizing):**
    - **Rotation:** After placing and sizing, rotate the design by exactly ${rotation} degrees.
    - **Offset:** After rotating, nudge the design horizontally by ${offsetX}% of the garment's width and vertically by ${offsetY}% of the garment's height. (A negative horizontal offset moves it left, a negative vertical offset moves it up).
- **Realism:** The design must blend realistically with the fabric. It should have a ${designPlacementControls.fabricBlend}% blend with the underlying fabric texture. It must ${designPlacementControls.wrinkleConform ? '' : 'NOT '}conform to the fabric's wrinkles, folds, lighting, and shadows.`;

            const isImageBackground = scene.background.type === 'image';
            const backgroundPrompt = isImageBackground
                ? `The garment is photographed within a realistic ${scene.background.name.toLowerCase()} environment. **CRITICAL PHOTOGRAPHY STYLE:** The background MUST be artistically blurred (bokeh), creating a shallow depth-of-field effect. The mockup itself must be the only sharp object in focus.`
                : `The garment should be set against a clean, simple ${scene.background.name.toLowerCase()} studio background. The background color/gradient should be subtle and complement the t-shirt.`;

            let textPrompt = `**PROFESSIONAL MOCKUP GENERATION**
**PRIMARY GOAL:** You are provided with two reference images: a MOCKUP of a blank garment, and a DESIGN to be placed on it. Your critical mission is to generate a new, ultra-photorealistic product photograph of the garment with the design applied, based on the following detailed instructions.

${mockupAndMaterialPrompt}

${designAndPlacementPrompt}

**PHOTOGRAPHY & SCENE:**
- **Lighting:** The scene must be lit with ${lightingStyle}.
- **Camera Angle:** ${cameraAnglePrompt}
- **Background:** ${backgroundPrompt}

**FINAL IMAGE STYLE & QUALITY:**
- **Aspect Ratio (CRITICAL):** The final image output MUST have an aspect ratio of exactly ${aspectRatio}.
- **Quality:** The final output must be an ultra-high-quality, hyperrealistic, and tack-sharp photograph, indistinguishable from a real product photo shot for a high-end e-commerce brand.
${styleDescription ? `- **Stylistic Goal:** The final image must match the artistic style described as: "${styleDescription}".\n` : ''}`;

            parts.push({ text: textPrompt });
            const { mimeType: mockupMime, data: mockupData } = parseDataUrl(mockupImage.base64);
            parts.push({ inlineData: { mimeType: mockupMime, data: mockupData } });
            
            const { mimeType: designMime, data: designData } = parseDataUrl(activeDesignImage.base64);
            parts.push({ inlineData: { mimeType: designMime, data: designData } });
            
            return { parts };
        }

        const {
            generationMode,
            styleDescription,
            aspectRatio,
        } = params;

        const creativeControls = params.studioMode === 'apparel' ? params.apparelControls : params.productControls;

        // --- Custom Prompt Override ---
        if (creativeControls.customPrompt && creativeControls.customPrompt.trim() !== '') {
            let customPromptText = `**PRIMARY GOAL:** You will receive a text prompt and multiple images. Your critical mission is to follow the text prompt to create a photorealistic image, using the provided images as assets.\n\n**USER PROMPT:**\n${creativeControls.customPrompt}`;
            
            parts.push({ text: customPromptText });
            
            if (params.studioMode === 'apparel' && params.uploadedModelImage) {
                 const { mimeType, data } = parseDataUrl(params.uploadedModelImage);
                 parts.push({ inlineData: { mimeType, data } });
            } else if (params.studioMode === 'product' && params.productImage) {
                 const { mimeType, data } = parseDataUrl(params.productImage);
                 parts.push({ inlineData: { mimeType, data } });
            }

            if (params.studioMode === 'apparel') {
                 for (const item of params.apparel) {
                    const { mimeType, data } = parseDataUrl(item.base64);
                    parts.push({ inlineData: { mimeType, data } });
                }
            }
            
            const isCustomBackground = params.scene.background.id === 'custom' && params.scene.background.type === 'image';
            if (isCustomBackground) {
                 const { mimeType, data } = parseDataUrl(params.scene.background.value);
                 parts.push({ inlineData: { mimeType, data } });
            }
            return { parts };
        }
        // --- End Custom Prompt Override ---

        // ===================================
        // --- PRODUCT MODE PROMPT LOGIC ---
        // ===================================
        if (params.studioMode === 'product') {
            const {stagedAssets, scene, productControls} = params;
            if (!stagedAssets || stagedAssets.length === 0) throw new Error("No product assets specified for prompt generation.");
            
            const {
                aperture,
                focalLength,
                cameraAngle,
                lightingDirection,
                lightQuality,
                catchlightStyle,
                isHyperRealismEnabled,
                cinematicLook,
                styleStrength,
                colorGrade,
                productShadow,
                customProps,
                surface,
                productMaterial,
            } = productControls;

            const isCustomBackground = scene.background.id === 'custom' && scene.background.type === 'image';
        
            const backgroundPrompt = isCustomBackground
                ? `in the environment depicted in the FINAL image provided`
                : scene.background.type === 'image'
                ? `in a photorealistic ${scene.background.name}`
                : `on a clean surface against a simple studio background with a ${scene.background.name.toLowerCase()} color.`;
            
            let lightingPrompt = '';
            if (scene.timeOfDay) {
                const timeOfDayDescriptions = {
                    'Sunrise': 'The lighting should evoke early morning sunrise, with soft, warm, low-angle light creating long, gentle shadows.',
                    'Midday': 'The lighting should be bright, direct midday sun from high above, creating harsh, defined shadows.',
                    'Golden Hour': 'The lighting must be warm, golden hour sunlight from the side, creating a beautiful, soft glow.',
                    'Twilight': 'The scene is lit by the cool, soft, ambient light of twilight (blue hour), with very soft or no distinct shadows.',
                    'Night': 'The scene is set at night, with dramatic, artificial light sources like streetlights or neon signs, creating high contrast.'
                };
                lightingPrompt = `**LIGHTING (CRITICAL):** ${timeOfDayDescriptions[scene.timeOfDay]}`;
            } else {
                lightingPrompt = `**LIGHTING (CRITICAL):** Apply ${scene.lighting.description}.`;
            }

            if (lightingDirection.id !== 'ld1') { // Not "As Described"
                lightingPrompt += ` The main light source is positioned ${lightingDirection.description}.`;
            }
            if (lightQuality.id !== 'lq1') { // Not "As Described"
                lightingPrompt += ` The light quality is ${lightQuality.description}.`;
            }
            
            lightingPrompt += ` The final image should feature ${catchlightStyle.description}.`;
            lightingPrompt += ' The product and background must all be lit from the same light source and direction to create a cohesive and realistic photograph.';
            
            const shadowDescription = {
                'Soft': 'The product must cast a realistic, soft, diffused shadow on the surface.',
                'Hard': 'The product must cast a realistic, hard, defined shadow on the surface, appropriate for the lighting.',
                'None': 'The product should appear to float slightly with no visible shadow.'
            }[productShadow];
            
            let productAndStagingPrompt = `**STAGING (CRITICAL):**
- You are provided with ${stagedAssets.length} image(s) of assets.
- Your mission is to arrange them in a new scene according to the following layout instructions.
- The coordinates (x, y) represent the center of the asset, where (0,0) is top-left and (100,100) is bottom-right.
- The z-index determines layering; a higher number is in front.

**Asset Layout & Details:**\n`;
            stagedAssets.forEach((asset, index) => {
                const assetType = asset.id === 'product' ? 'PRIMARY PRODUCT' : `Companion Asset ${index}`;
                
                let materialPrompt = '';
                if (asset.id === 'product') {
                    if (productMaterial.category === 'Artistic') {
                         materialPrompt = `Artistic Transformation: The primary product must be artistically transformed into ${productMaterial.description}. This is a creative re-interpretation, not a simple material change.\n`;
                    } else {
                        materialPrompt = `Material & Style: The primary product should be rendered as if it is made of ${productMaterial.description}. Render lighting, shadows, and reflections to match this material realistically.\n`;
                    }
                }

                productAndStagingPrompt += `- **Image ${index+1} (${assetType}):**
    - Position: Place the center of this asset at approximately x=${asset.x.toFixed(0)}, y=${asset.y.toFixed(0)}.
    - Layer: Render at layer z=${asset.z}.
    - Size: The asset should be scaled to ${asset.scale.toFixed(0)}% of the staging canvas's longest side.
    - Do NOT alter the asset itself unless specified by the material style below.
    ${materialPrompt ? `- ${materialPrompt}` : ''}`;
            });
            
            let textPrompt = `**PROFESSIONAL PRODUCT PHOTOSHOOT**
**PRIMARY GOAL:** You are provided with product images that have been isolated on a clean background. Your critical mission is to place these products onto a new surface within a beautifully composed, photorealistic scene, following the precise layout instructions.

${productAndStagingPrompt}

**SCENE & STAGING:**
- The product(s) are ${surface.description}.
- The overall scene is ${backgroundPrompt}.
- ${shadowDescription}
${customProps.trim() ? `- **PROPS (CRITICAL):** The scene must include the following elements, arranged naturally and artistically around the main product: ${customProps.trim()}.\n` : ''}${scene.environmentalEffects.trim() ? `- **ENVIRONMENTAL EFFECTS:** The scene must include these atmospheric effects: ${scene.environmentalEffects.trim()}.\n` : ''}
- ${lightingPrompt}

**CAMERA & LENS:**
- The photo is ${cameraAngle.description}.
- The photo is shot ${aperture.description}.
- The photo is shot with ${focalLength.description}.

**FINAL IMAGE STYLE & QUALITY:**
- **Aspect Ratio (CRITICAL):** The final image output MUST have an aspect ratio of exactly ${aspectRatio}.
${styleDescription ? `- **Stylistic Goal:** The final image must match the artistic style described as: "${styleDescription}". Apply this style with an influence of approximately ${styleStrength}%. A value of 100% is a perfect match, 50% is a subtle blend.\n` : ''}${colorGrade.id !== 'cg_none' ? `- **Color Grade:** Apply a professional color grade with the following style: ${colorGrade.description}\n` : ''}- This is a professional product photoshoot for a luxury brand. The final output must be an ultra-high-quality, hyperrealistic, and tack-sharp photograph, indistinguishable from a real photo shot on a high-end DSLR camera.
- Pay extreme attention to detail, especially in material texture, lighting, shadows, and reflections.
`;
            if (cinematicLook) {
                textPrompt += `
**CINEMATIC LOOK (ENABLED):**
- The image must have a cinematic quality, emulating a still from a high-budget film.
- Use properties associated with anamorphic lenses, such as subtle lens flares and a slightly wider feel.
- Apply a professional, non-destructive color grade (e.g., teal and orange, or a muted filmic look).
- Add a fine, realistic film grain to the entire image.
`;
            }

            if (isHyperRealismEnabled) {
                textPrompt += `
**HYPER-REALISM MODE (ENABLED):**
- Pay extreme attention to micro-details like material textures, reflections, and subtle light interactions.
- Ensure the product is rendered with 100% accuracy and realism.
- This is for a luxury brand product shot; the final image must be indistinguishable from a high-end DSLR photograph.
`;
            }
            parts.unshift({ text: textPrompt });
            
            stagedAssets.sort((a,b) => a.id === 'product' ? -1 : 1).forEach(asset => {
                const { mimeType, data } = parseDataUrl(asset.base64);
                parts.push({ inlineData: { mimeType, data } });
            });
            
            if (isCustomBackground) {
                const { mimeType, data } = parseDataUrl(scene.background.value);
                parts.push({ inlineData: { mimeType, data } });
            }

            return { parts };
        }

        // ===================================
        // --- APPAREL MODE PROMPT LOGIC ---
        // ===================================
        const {
            uploadedModelImage, selectedModel, apparel, scene, animation, promptedModelDescription,
            modelLightingDescription, apparelControls
        } = params;
        const {
            shotType,
            expression,
            aperture,
            focalLength,
            fabric,
            cameraAngle,
            lightingDirection,
            lightQuality,
            catchlightStyle,
            isHyperRealismEnabled,
            cinematicLook,
            styleStrength,
            colorGrade,
            hairStyle,
            makeupStyle,
            garmentStyling,
        } = apparelControls;

        let textPrompt = `**MASTER PHOTOSHOOT DIRECTIVE**

**NON-NEGOTIABLE RULES OF EXECUTION:**
1.  **STRICT MODULARITY:** You are given separate instructions for the MODEL, APPAREL, POSE, and SCENE. Each is independent and absolute. Do not infer details from one section to another (e.g., do not use the background from the model image, or the pose from the apparel image).
2.  **INPUTS ARE LAW:** You MUST follow the text descriptions and use the provided image assets as the definitive source of truth. User settings override all defaults.
3.  **ABSOLUTE APPAREL ACCURACY:** The apparel's design, pattern, and color must be derived *exclusively* from the provided apparel images.
4.  **IDENTITY PRESERVATION:** The human model's identity (face, body, etc.) must be preserved with 100% accuracy from the provided model source (image or text).

---
`;
        
        // --- 1. MODEL ---
        if (uploadedModelImage) {
            let modelPrompt = `**1. MODEL IDENTITY & STYLING (Source: First Image + User Settings)**
- **FACE (CRITICAL):** Recreate the person's face from the first image with perfect accuracy. This is the highest priority.
- **BODY (Conditional Logic):**
    - If the reference image shows the model's body (full-body or waist-up), you MUST recreate their body type and proportions with the same accuracy as the face.
    - If the reference image is a close-up headshot, you MUST generate a new, realistic, and proportionate body that is a perfect match for the model's face, apparent age, gender, and ethnicity.

- **STYLING OVERRIDES (Source: User Settings):** Apply the following styling TO the recreated person:\n`;
            
            if (hairStyle.trim()) {
                modelPrompt += `    - **HAIR:** The model's hair is styled as: "${hairStyle.trim()}".\n`;
            }
            if (makeupStyle.trim()) {
                modelPrompt += `    - **MAKEUP:** The model's makeup is a "${makeupStyle.trim()}" look.\n`;
            }
            if (!hairStyle.trim() && !makeupStyle.trim()) {
                modelPrompt += `    - No specific hair or makeup styles provided; maintain the natural look from the image.\n`
            }
        
            modelPrompt += `- **CRITICAL RULE:** Do NOT change the model's core facial features to match the new styling. Ignore any clothing, background, or pose in the reference image.\n\n`;
        
            textPrompt += modelPrompt;
            const { mimeType, data } = parseDataUrl(uploadedModelImage);
            parts.push({ inlineData: { mimeType, data } });

        } else if (selectedModel) {
            textPrompt += `**1. MODEL IDENTITY & STYLING (Source: Text Description + User Settings)**
- **MISSION:** Generate a model that perfectly and exclusively matches this description: ${selectedModel.description}.\n`;
            if (hairStyle.trim()) textPrompt += `- The model's hair is styled as: "${hairStyle.trim()}".\n`;
            if (makeupStyle.trim()) textPrompt += `- The model's makeup is a "${makeupStyle.trim()}" look.\n`;
            textPrompt += '\n';

        } else if (promptedModelDescription.trim()) {
            textPrompt += `**1. MODEL IDENTITY & STYLING (Source: Text Description + User Settings)**
- **MISSION:** Generate a model that perfectly and exclusively matches this description: ${promptedModelDescription}.\n`;
            if (hairStyle.trim()) textPrompt += `- The model's hair is styled as: "${hairStyle.trim()}".\n`;
            if (makeupStyle.trim()) textPrompt += `- The model's makeup is a "${makeupStyle.trim()}" look.\n`;
            textPrompt += '\n';

        } else {
            throw new Error("No model specified for prompt generation.");
        }
        
        // --- 2. APPAREL & STYLING ---
        const isBackViewShot = shotType.name.toLowerCase().includes('back');
        let apparelText = `**2. APPAREL & STYLING (Source: Subsequent Images + User Settings)**
- **MISSION:** Realistically dress the model with ALL apparel items from the provided images. They must fit naturally, replacing any other clothing.
- **VIEW-SPECIFIC RENDERING (NON-NEGOTIABLE):** The selected shot type is "${shotType.name}". This dictates which side of the apparel to show.\n`;

        if (isBackViewShot) {
            apparelText += `- **MANDATORY INSTRUCTION FOR BACK VIEW:** Because this is a back-view shot, you MUST render the **BACK** of the garments. You will be provided with images of the back view of the garments where available.\n`;
        } else { // Front or 3/4 view
            apparelText += `- **MANDATORY INSTRUCTION FOR FRONT/SIDE VIEW:** Because this is a front-facing or side-view shot, you MUST render the **FRONT** of the garments.\n`;
        }
        
        const apparelPartsToAdd: any[] = [];
        apparel.forEach((item, index) => {
            let imageToUse = item.base64;
            let viewDescriptionForPrompt = "front view";
            if (isBackViewShot && item.backViewBase64) {
                imageToUse = item.backViewBase64;
                viewDescriptionForPrompt = "back view";
            }
            apparelText += `- Apparel Item ${index + 1} (${item.category}): Replicate the **${viewDescriptionForPrompt}** of this item exactly from its image.\n`;
            const { mimeType, data } = parseDataUrl(imageToUse);
            apparelPartsToAdd.push({ inlineData: { mimeType, data } });
        });

        apparelText += `\n- **STYLING DETAILS:**\n`;
        if (garmentStyling.trim()) {
            apparelText += `    - **Garment Styling:** The clothing should be styled as follows: ${garmentStyling.trim()}.\n`;
        }
        if (fabric.id !== 'fab1') {
            apparelText += `    - **Fabric Texture:** The primary garment(s) should have the texture of ${fabric.description}\n`;
        }

        if (apparel.length > 1) {
            const layerDescriptions = apparel.map((item, index) => `Item ${index + 1} (${item.category})`).join(', then ');
            apparelText += `- **LAYERING (CRITICAL):** The items must be worn from innermost to outermost in this exact order: ${layerDescriptions}.\n`;
        }
        
        const hasTop = apparel.some(item => item.category === 'Top' || item.category === 'Outerwear' || item.category === 'Full Body');
        const hasBottom = apparel.some(item => item.category === 'Bottom' || item.category === 'Full Body');

        if (hasTop && !hasBottom) {
            apparelText += `- **OUTFIT COMPLETION (CRITICAL):** The user has only provided a top. To create a complete and realistic outfit, the model MUST also be wearing simple, stylish bottoms (like dark jeans, black trousers, or a neutral skirt) that complement the main apparel. The bottoms should not be the focus of the image.\n`;
        } else if (!hasTop && hasBottom) {
            apparelText += `- **OUTFIT COMPLETION (CRITICAL):** The user has only provided bottoms. To create a complete and realistic outfit, the model MUST also be wearing a simple, stylish top (like a plain white t-shirt or a black tank top) that complements the main apparel. The top should not be the focus of the image.\n`;
        } else {
            apparelText += `- **STRICT ADHERENCE:** Do NOT invent or add any apparel items or accessories not specified.\n`;
        }
        
        textPrompt += apparelText + '\n';
        parts.push(...apparelPartsToAdd);
        
        // --- 3. POSE ---
        textPrompt += `**3. POSE (Source: User Settings)**
- **POSE (Body Language):** The model must be positioned exactly as described: ${shotType.description}.
- **EXPRESSION:** The model's facial expression must be: ${expression.description}.\n\n`;


        // --- 4. SCENE & LIGHTING ---
        const isCustomBackground = scene.background.id === 'custom' && scene.background.type === 'image';
        const backgroundPrompt = isCustomBackground
            ? `in the environment depicted in the FINAL image provided`
            : scene.background.type === 'image'
            ? `in a photorealistic ${scene.background.name}`
            : `against a simple studio background with a ${scene.background.name.toLowerCase()} color.`;

        let lightingPrompt = '';
        if (scene.timeOfDay) {
            const timeOfDayDescriptions = {
                'Sunrise': 'The lighting should evoke early morning sunrise, with soft, warm, low-angle light creating long, gentle shadows.',
                'Midday': 'The lighting should be bright, direct midday sun from high above, creating harsh, defined shadows.',
                'Golden Hour': 'The lighting must be warm, golden hour sunlight from the side, creating a beautiful, soft glow.',
                'Twilight': 'The scene is lit by the cool, soft, ambient light of twilight (blue hour), with very soft or no distinct shadows.',
                'Night': 'The scene is set at night, with dramatic, artificial light sources like streetlights or neon signs, creating high contrast.'
            };
            lightingPrompt = `${timeOfDayDescriptions[scene.timeOfDay]}`;
        } else if (scene.lighting.isDynamic && modelLightingDescription) {
            lightingPrompt = `The lighting must perfectly match the following description, which was analyzed from the original model's photo: "${modelLightingDescription}".`;
        } else {
            lightingPrompt = `Apply ${scene.lighting.description}.`;
        }

        if (lightingDirection.id !== 'ld1') { // Not "As Described"
            lightingPrompt += ` The main light source is positioned ${lightingDirection.description}.`;
        }
        if (lightQuality.id !== 'lq1') { // Not "As Described"
            lightingPrompt += ` The light quality is ${lightQuality.description}.`;
        }
        
        lightingPrompt += ` The final image should feature ${catchlightStyle.description}.`;
        lightingPrompt += ' The model, apparel, and background must all be lit from the same light source and direction to create a cohesive and realistic photograph.';

        textPrompt += `**4. SCENE & LIGHTING (Source: User Settings)**
- **BACKGROUND:** The scene is set ${backgroundPrompt}.
- **LIGHTING (CRITICAL):** ${lightingPrompt}
`;
        if(scene.sceneProps.trim()){
            textPrompt += `- **PROPS:** The scene must include: ${scene.sceneProps.trim()}.\n`;
        }
        if(scene.environmentalEffects.trim()){
            textPrompt += `- **EFFECTS:** The scene should have these atmospheric effects: ${scene.environmentalEffects.trim()}.\n`;
        }
        textPrompt += '\n';

        // --- 5. CAMERA & LENS ---
        textPrompt += `**5. CAMERA & LENS (Source: User Settings)**
- **CAMERA ANGLE:** ${cameraAngle.description}.
- **APERTURE:** ${aperture.description}.
- **FOCAL LENGTH:** ${focalLength.description}.\n\n`;

        // --- 6. FINAL IMAGE STYLE & QUALITY ---
        textPrompt += `**6. FINAL IMAGE STYLE & QUALITY (Source: User Settings)**
- **ASPECT RATIO (CRITICAL):** The final image output MUST have an aspect ratio of exactly ${aspectRatio}.
- **QUALITY:** This is a professional photoshoot. The final output must be an ultra-high-quality, hyperrealistic, and tack-sharp photograph, indistinguishable from a real photo. Emulate a high-end DSLR camera (e.g., Canon EOS R5) with a professional prime lens. Pay extreme attention to detail, especially in fabric texture, lighting, shadows, and skin detail.
`;
       if (styleDescription) {
            textPrompt += `- **STYLISTIC GOAL:** The final image must match the artistic style described as: "${styleDescription}". Apply this style with an influence of approximately ${styleStrength}%. A value of 100% is a perfect match, 50% is a subtle blend.\n`;
       }
       if (colorGrade.id !== 'cg_none') {
            textPrompt += `- **COLOR GRADE:** Apply a professional color grade with the following style: ${colorGrade.description}\n`;
       }
       if (cinematicLook) {
            textPrompt += `
**CINEMATIC LOOK (ENABLED):**
- The image must have a cinematic quality, emulating a still from a high-budget film.
- Use properties associated with anamorphic lenses, such as subtle lens flares and a slightly wider feel.
- Apply a professional, non-destructive color grade (e.g., teal and orange, or a muted filmic look).
- Add a fine, realistic film grain to the entire image.
`;
        }

        if (isHyperRealismEnabled) {
            textPrompt += `
**HYPER-REALISM MODE (ENABLED):**
- Pay extreme attention to micro-details like skin pores, fabric weave, and subtle light reflections.
- Ensure all human anatomy, especially hands and fingers, is rendered with 100% accuracy.
- This is for a luxury brand photoshoot; the final image must be indistinguishable from a high-end DSLR photograph.
`;
        }

        if (animation) {
            textPrompt += `
**ANIMATION:**
- The model is ${animation.description}.`
        }

        // Add the compiled text prompt as the very first part
        parts.unshift({ text: textPrompt });
        
        // Add custom background as the VERY LAST part
        if (isCustomBackground) {
             const { mimeType, data } = parseDataUrl(scene.background.value);
             parts.push({ inlineData: { mimeType, data } });
        }


        return { parts };
    }
};
