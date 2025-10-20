// Professional fashion photography prompt generator for Gemini AI

export interface FashionPromptParams {
    modelImage: string; // base64 data URL
    apparelImage: string; // base64 data URL
    scene: {
        background: string;
        lighting: string;
        timeOfDay?: string;
    };
    aspectRatio: string;
    style?: string;
    mood?: string;
}

export const fashionPromptGenerator = {
    /**
     * Generates a professional fashion photography prompt for Gemini AI
     */
    generateFashionPrompt: (params: FashionPromptParams): string => {
        const { scene, aspectRatio, style = 'high-fashion', mood = 'elegant' } = params;
        
        return `**PROFESSIONAL FASHION PHOTOGRAPHY GENERATION**

**MISSION:** Create a stunning, commercially-ready fashion photograph where the model is wearing the exact clothing from the apparel reference image. This should look like a professional fashion shoot from a top-tier magazine or brand campaign.

**CRITICAL REQUIREMENTS:**
1. **MODEL FACE & BODY:** Use the model's exact face, body type, and physical features from the model reference image
2. **CLOTHING:** The model must be wearing the exact clothing item from the apparel reference image - same style, color, texture, and fit
3. **PROFESSIONAL QUALITY:** Studio-quality lighting, composition, and post-production
4. **REALISTIC:** Photorealistic result that looks like a real fashion photograph

**SCENE SETUP:**
- Background: ${scene.background}
- Lighting: ${scene.lighting}
- Time of Day: ${scene.timeOfDay || 'studio lighting'}
- Aspect Ratio: ${aspectRatio}

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
- Perfect fit and draping of the garment
- Professional posing and expression
- High-end fashion photography aesthetic
- Commercial-ready quality

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
