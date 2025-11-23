// Professional fashion photography prompt generator for Gemini AI

export interface FashionControlSettings {
    pose?: string;
    expression?: string;
    cameraAngle?: string;
    aperture?: string;
    focalLength?: string;
    lightingDirection?: string;
    lightQuality?: string;
    catchlight?: string;
    hairStyle?: string;
    makeupStyle?: string;
    garmentStyling?: string;
    fabricTexture?: string;
    colorGrade?: string;
    sceneProps?: string;
    environmentalEffects?: string;
    cinematicLook?: boolean;
    hyperRealism?: boolean;
}

export interface FashionPromptParams {
    modelImage: string; // base64 data URL
    apparelImage: string; // base64 data URL
    scene: {
        background: string;
        lighting: string;
        timeOfDay?: string;
        props?: string;
        effects?: string;
    };
    aspectRatio: string;
    style?: string;
    mood?: string;
    controls?: FashionControlSettings;
}

export const fashionPromptGenerator = {
    /**
     * Generates a professional fashion photography prompt for Gemini AI
     */
    generateFashionPrompt: (params: FashionPromptParams): string => {
        const { scene, aspectRatio, style = 'high-fashion', mood = 'elegant', controls } = params;

        const propsDescription = scene.props?.trim() ? scene.props : 'Only include props explicitly requested by the user.';
        const effectsDescription = scene.effects?.trim() ? scene.effects : 'Use atmospheric effects only if the user requested them.';

        const controlDirectives: string[] = [];
        if (controls) {
            if (controls.pose) controlDirectives.push(`- **Pose / Body Language:** ${controls.pose}`);
            if (controls.expression) controlDirectives.push(`- **Facial Expression:** ${controls.expression}`);
            if (controls.cameraAngle) controlDirectives.push(`- **Camera Angle:** ${controls.cameraAngle}`);
            if (controls.aperture) controlDirectives.push(`- **Aperture / Depth of Field:** ${controls.aperture}`);
            if (controls.focalLength) controlDirectives.push(`- **Focal Length:** ${controls.focalLength}`);
            if (controls.lightingDirection) controlDirectives.push(`- **Lighting Direction:** ${controls.lightingDirection}`);
            if (controls.lightQuality) controlDirectives.push(`- **Light Quality:** ${controls.lightQuality}`);
            if (controls.catchlight) controlDirectives.push(`- **Catchlight Style:** ${controls.catchlight}`);
            if (controls.hairStyle) controlDirectives.push(`- **Hair Styling:** ${controls.hairStyle}`);
            if (controls.makeupStyle) controlDirectives.push(`- **Makeup:** ${controls.makeupStyle}`);
            if (controls.garmentStyling) controlDirectives.push(`- **Garment Styling Notes:** ${controls.garmentStyling}`);
            if (controls.fabricTexture) controlDirectives.push(`- **Fabric Texture Preference:** ${controls.fabricTexture}`);
            if (controls.colorGrade) controlDirectives.push(`- **Color Grade:** ${controls.colorGrade}`);
            if (controls.sceneProps) controlDirectives.push(`- **Required Props:** ${controls.sceneProps}`);
            if (controls.environmentalEffects) controlDirectives.push(`- **Atmospheric Effects:** ${controls.environmentalEffects}`);
            if (controls.cinematicLook) controlDirectives.push(`- **Cinematic Mode:** Enable subtle anamorphic characteristics, tasteful film grain, and high-end color grading.`);
            if (controls.hyperRealism) controlDirectives.push(`- **Hyper-Realism:** Render micro-details (skin pores, fabric weave, hands/fingers) with impeccable accuracy.`);
        }
        
        return `**PROFESSIONAL FASHION PHOTOGRAPHY GENERATION**

**MISSION:** Create a stunning, commercially-ready fashion photograph where the model is wearing the exact clothing from the apparel reference image. This should look like a professional fashion shoot from a top-tier magazine or brand campaign.

**CRITICAL REQUIREMENTS:**
1. **MODEL FACE & BODY:** Use the model's exact face, body type, and physical features from the model reference image. **Do not change the model's facial structure, expression, skin tone, or identity — treat the face as locked and untouchable.** If a model reference image is provided, you are photographing that *exact person*. Reuse the identical facial identity — no beautification, morphing, or reinterpretation.
2. **CLOTHING:** The model must be wearing the exact clothing item from the apparel reference image - same style, color, texture, and fit
3. **USER SETTINGS ARE LAW:** Apply every studio control exactly as selected by the user — pose, gesture (e.g., hand on hips), expression, camera angle, crop, background, props, color grade, etc. No substitutions or omissions.
4. **PROFESSIONAL QUALITY:** Studio-quality lighting, composition, and post-production
5. **REALISTIC:** Photorealistic result that looks like a real fashion photograph

**SCENE SETUP:**
- Background: ${scene.background}
- Lighting: ${scene.lighting}
- Time of Day: ${scene.timeOfDay || 'studio lighting'}
- Props: ${propsDescription}
- Effects: ${effectsDescription}
- Aspect Ratio: ${aspectRatio}

${controlDirectives.length ? `**USER-DEFINED DIRECTIVES (MUST FOLLOW EXACTLY):**
${controlDirectives.join('\n')}
` : ''}

**STYLE & MOOD:**
- Style: ${style}
- Mood: ${mood}
- Photography Style: Professional fashion photography
- Quality: Magazine-cover quality, commercial-grade

**TECHNICAL SPECIFICATIONS:**
- Resolution: Ultra-high resolution
- Lighting: Professional studio lighting with perfect exposure
- Composition: Fashion photography composition rules
- Post-production: Professional color grading and retouching
- Realism: Photorealistic, no AI artifacts

**OUTPUT REQUIREMENTS:**
- The model should look natural and comfortable in the clothing
- The face must be pixel-accurate to the reference image. No morphing, beautification, or identity drift is allowed under any circumstance.
- Perfect fit and draping of the garment
- Professional posing and expression that match the chosen controls exactly (no improvisation)
- High-end fashion photography aesthetic
- Commercial-ready quality
- Every user-selected control must appear in the final image. Do not omit, replace, or reinterpret any instruction.

Generate a single, stunning fashion photograph that combines the model and clothing seamlessly.`;
    },

    /**
     * Generates a prompt for different fashion styles
     */
    generateStyleSpecificPrompt: (basePrompt: string, style: string): string => {
        const styleModifiers = {
            'high-fashion': 'High-fashion editorial style with dramatic lighting and avant-garde composition',
            'commercial': 'Clean commercial fashion photography with bright, even lighting',
            'streetwear': 'Urban streetwear aesthetic with natural lighting and casual posing',
            'luxury': 'Luxury brand aesthetic with sophisticated lighting and elegant composition',
            'casual': 'Lifestyle casual fashion with natural, relaxed lighting',
            'editorial': 'Fashion editorial style with artistic lighting and creative composition',
            'e-commerce': 'Clean e-commerce product photography with neutral background and even lighting'
        };

        const modifier = styleModifiers[style as keyof typeof styleModifiers] || styleModifiers['commercial'];
        
        return `${basePrompt}

**STYLE SPECIFICATION:**
${modifier}

Ensure the final image matches this specific fashion photography style while maintaining professional quality and realism.`;
    },

    /**
     * Generates prompts for different moods
     */
    generateMoodSpecificPrompt: (basePrompt: string, mood: string): string => {
        const moodModifiers = {
            'elegant': 'Elegant and sophisticated mood with refined posing and expression',
            'confident': 'Strong, confident mood with powerful posing and direct eye contact',
            'playful': 'Playful and energetic mood with dynamic posing and bright expression',
            'mysterious': 'Mysterious and intriguing mood with subtle lighting and enigmatic expression',
            'romantic': 'Romantic and soft mood with gentle lighting and warm expression',
            'edgy': 'Edgy and bold mood with dramatic lighting and strong attitude',
            'natural': 'Natural and relaxed mood with soft lighting and authentic expression'
        };

        const modifier = moodModifiers[mood as keyof typeof moodModifiers] || moodModifiers['elegant'];
        
        return `${basePrompt}

**MOOD SPECIFICATION:**
${modifier}

The model's expression, pose, and overall energy should convey this specific mood while maintaining professional fashion photography standards.`;
    }
};
