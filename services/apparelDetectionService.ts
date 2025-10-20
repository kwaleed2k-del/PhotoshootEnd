// AI-powered apparel type detection service using Gemini AI

import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export interface ApparelDetectionResult {
    category: string;
    subcategory: string;
    description: string;
    colors: string[];
    style: string;
    occasion: string;
    confidence: number;
}

export const apparelDetectionService = {
    /**
     * Detects apparel type and details from an uploaded image
     */
    detectApparelType: async (imageBase64: string): Promise<ApparelDetectionResult> => {
        if (!ai) {
            // Mock detection for development
            return mockApparelDetection();
        }

        try {
            console.log("🔍 Using Gemini AI to detect apparel type...");
            
            // Use the correct @google/genai API
            const model = "gemini-2.5-flash-image-preview";

            const prompt = `**APPAREL TYPE DETECTION TASK**

You are a professional fashion expert and AI assistant. Analyze the uploaded clothing image and provide detailed information about the apparel.

**REQUIRED OUTPUT FORMAT (JSON only):**
{
  "category": "Main category (e.g., 'Suit', 'Dress', 'Shirt', 'Pants', 'Jacket', 'Sweater', 'Skirt', 'Shorts', 'Coat', 'Blouse', 'T-shirt', 'Jeans', 'Sweatshirt', 'Hoodie', 'Cardigan', 'Vest', 'Blazer', 'Trousers', 'Jumpsuit', 'Romper', 'Tank Top', 'Polo Shirt', 'Dress Shirt', 'Casual Shirt', 'Formal Shirt', 'Business Shirt', 'Evening Wear', 'Activewear', 'Loungewear', 'Outerwear', 'Accessories')",
  "subcategory": "Specific subcategory (e.g., 'Three-piece Suit', 'Cocktail Dress', 'Button-down Shirt', 'Skinny Jeans', 'Bomber Jacket', 'Cable Knit Sweater', 'A-line Skirt', 'Cargo Shorts', 'Trench Coat', 'Silk Blouse', 'Graphic T-shirt', 'Distressed Jeans', 'Pullover Hoodie', 'Open Cardigan', 'Waistcoat', 'Single-breasted Blazer', 'Chino Trousers', 'Wrap Jumpsuit', 'Sleeveless Romper', 'Ribbed Tank Top', 'Polo Shirt', 'Oxford Shirt', 'Flannel Shirt', 'Dress Shirt', 'Tuxedo Shirt', 'Yoga Pants', 'Sweatpants', 'Puffer Jacket', 'Scarf')",
  "description": "Detailed description of the clothing item including fabric, fit, style, and key features",
  "colors": ["Array of primary colors detected in the clothing"],
  "style": "Style classification (e.g., 'Formal', 'Casual', 'Business', 'Evening', 'Streetwear', 'Vintage', 'Modern', 'Classic', 'Trendy', 'Minimalist', 'Bohemian', 'Preppy', 'Grunge', 'Athletic', 'Elegant', 'Edgy', 'Romantic', 'Professional', 'Relaxed', 'Sophisticated')",
  "occasion": "Recommended occasions (e.g., 'Business Meeting', 'Casual Day', 'Evening Event', 'Date Night', 'Work', 'Weekend', 'Formal Event', 'Party', 'Travel', 'Gym', 'Home', 'Outdoor Activity', 'Wedding', 'Interview', 'Dinner', 'Shopping', 'Beach', 'Hiking', 'Office', 'School')",
  "confidence": "Confidence score from 0.0 to 1.0"
}

**ANALYSIS GUIDELINES:**
1. Look at the overall silhouette and cut of the garment
2. Identify the fabric type and texture if visible
3. Note any distinctive features (buttons, pockets, collars, etc.)
4. Determine the formality level
5. Consider the fit (loose, fitted, oversized, etc.)
6. Identify the target demographic and occasion
7. Be specific about the subcategory - don't just say "shirt" if it's clearly a "dress shirt" or "polo shirt"

**IMPORTANT:** 
- Return ONLY valid JSON, no additional text
- Be as specific as possible with categories and subcategories
- Confidence should reflect how certain you are about the classification
- If multiple items are visible, focus on the most prominent one

Analyze the image and provide the JSON response:`;

            const parts = [
                { text: prompt },
                { 
                    inlineData: { 
                        mimeType: 'image/jpeg', 
                        data: imageBase64.split(',')[1] // Remove data:image/jpeg;base64, prefix
                    } 
                }
            ];

            const result = await ai.models.generateContent({
                model,
                contents: { parts }
            });
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Parse JSON response
            try {
                const detectionResult = JSON.parse(text);
                console.log("✅ Apparel detection successful:", detectionResult);
                return detectionResult;
            } catch (parseError) {
                console.error("Failed to parse AI response:", parseError);
                console.log("Raw response:", text);
                return mockApparelDetection();
            }

        } catch (error) {
            console.error("Error detecting apparel type:", error);
            return mockApparelDetection();
        }
    },

    /**
     * Gets predefined apparel categories for the dropdown
     */
    getApparelCategories: (): string[] => {
        return [
            'Top',
            'Bottom', 
            'Full Body',
            'Outerwear',
            'Accessory',
            'Footwear',
            'Dress',
            'Suit',
            'Shirt',
            'Pants',
            'Jacket',
            'Sweater',
            'Skirt',
            'Shorts',
            'Coat',
            'Blouse',
            'T-shirt',
            'Jeans',
            'Sweatshirt',
            'Hoodie',
            'Cardigan',
            'Vest',
            'Blazer',
            'Trousers',
            'Jumpsuit',
            'Romper',
            'Tank Top',
            'Polo Shirt',
            'Dress Shirt',
            'Casual Shirt',
            'Formal Shirt',
            'Business Shirt',
            'Evening Wear',
            'Activewear',
            'Loungewear'
        ];
    }
};

// Mock detection for development
const mockApparelDetection = (): ApparelDetectionResult => {
    return {
        category: 'Suit',
        subcategory: 'Three-piece Suit',
        description: 'Professional three-piece suit in light beige/tan color with matching jacket, vest, and trousers. Features single-breasted jacket with notched lapels, double-breasted vest, and well-fitted trousers.',
        colors: ['Beige', 'Tan', 'Light Brown'],
        style: 'Formal',
        occasion: 'Business Meeting',
        confidence: 0.95
    };
};
