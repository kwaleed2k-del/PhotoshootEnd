// Image composition utilities for combining model and apparel images
export interface ImageCompositionOptions {
    modelImage: string; // base64 data URL
    apparelImage: string; // base64 data URL
    width: number;
    height: number;
    style?: 'overlay' | 'side-by-side' | 'composite';
}

export const imageComposer = {
    /**
     * Creates a composite image showing the model and apparel side by side
     */
    createSideBySideComposition: async (options: ImageCompositionOptions): Promise<string> => {
        const { modelImage, apparelImage, width, height } = options;
        
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }
            
            // Fill background
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, width, height);
            
            const modelImg = new Image();
            const apparelImg = new Image();
            let loadedCount = 0;
            
            const onImageLoad = () => {
                loadedCount++;
                if (loadedCount === 2) {
                    // Draw model on left half
                    const modelWidth = width / 2 - 20;
                    const modelHeight = (modelWidth * modelImg.height) / modelImg.width;
                    const modelY = (height - modelHeight) / 2;
                    
                    ctx.drawImage(modelImg, 10, modelY, modelWidth, modelHeight);
                    
                    // Draw apparel on right half
                    const apparelWidth = width / 2 - 20;
                    const apparelHeight = (apparelWidth * apparelImg.height) / apparelImg.width;
                    const apparelY = (height - apparelHeight) / 2;
                    
                    ctx.drawImage(apparelImg, width / 2 + 10, apparelY, apparelWidth, apparelHeight);
                    
                    // Add labels
                    ctx.fillStyle = '#333';
                    ctx.font = 'bold 18px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('Model', width / 4, 30);
                    ctx.fillText('Apparel', 3 * width / 4, 30);
                    
                    // Add processing message
                    ctx.font = '14px Arial';
                    ctx.fillStyle = '#666';
                    ctx.fillText('AI Processing: Combining model with apparel...', width / 2, height - 20);
                    
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                }
            };
            
            modelImg.onload = onImageLoad;
            modelImg.onerror = () => reject(new Error('Failed to load model image'));
            modelImg.src = modelImage;
            
            apparelImg.onload = onImageLoad;
            apparelImg.onerror = () => reject(new Error('Failed to load apparel image'));
            apparelImg.src = apparelImage;
        });
    },
    
    /**
     * Creates an overlay composition showing the apparel overlaid on the model
     */
    createOverlayComposition: async (options: ImageCompositionOptions): Promise<string> => {
        const { modelImage, apparelImage, width, height } = options;
        
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }
            
            // Fill background
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, width, height);
            
            const modelImg = new Image();
            const apparelImg = new Image();
            let loadedCount = 0;
            
            const onImageLoad = () => {
                loadedCount++;
                if (loadedCount === 2) {
                    // Draw model as base
                    const modelWidth = width * 0.8;
                    const modelHeight = (modelWidth * modelImg.height) / modelImg.width;
                    const modelX = (width - modelWidth) / 2;
                    const modelY = (height - modelHeight) / 2;
                    
                    ctx.drawImage(modelImg, modelX, modelY, modelWidth, modelHeight);
                    
                    // Draw apparel overlay (semi-transparent)
                    ctx.globalAlpha = 0.7;
                    const apparelWidth = width * 0.4;
                    const apparelHeight = (apparelWidth * apparelImg.height) / apparelImg.width;
                    const apparelX = width - apparelWidth - 20;
                    const apparelY = 20;
                    
                    ctx.drawImage(apparelImg, apparelX, apparelY, apparelWidth, apparelHeight);
                    ctx.globalAlpha = 1.0;
                    
                    // Add processing message
                    ctx.fillStyle = '#333';
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('AI Processing: Merging model with apparel...', width / 2, height - 30);
                    
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                }
            };
            
            modelImg.onload = onImageLoad;
            modelImg.onerror = () => reject(new Error('Failed to load model image'));
            modelImg.src = modelImage;
            
            apparelImg.onload = onImageLoad;
            apparelImg.onerror = () => reject(new Error('Failed to load apparel image'));
            apparelImg.src = apparelImage;
        });
    },
    
    /**
     * Creates a professional composite showing the final result
     */
    createFinalComposite: async (options: ImageCompositionOptions): Promise<string> => {
        const { modelImage, apparelImage, width, height } = options;
        
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }
            
            // Create gradient background
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
            
            const modelImg = new Image();
            const apparelImg = new Image();
            let loadedCount = 0;
            
            const onImageLoad = () => {
                loadedCount++;
                if (loadedCount === 2) {
                    // Draw model as main subject
                    const modelWidth = width * 0.6;
                    const modelHeight = (modelWidth * modelImg.height) / modelImg.width;
                    const modelX = (width - modelWidth) / 2;
                    const modelY = (height - modelHeight) / 2;
                    
                    // Add shadow
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                    ctx.shadowBlur = 20;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 10;
                    
                    ctx.drawImage(modelImg, modelX, modelY, modelWidth, modelHeight);
                    
                    // Reset shadow
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                    
                    // Draw apparel in corner
                    const apparelWidth = width * 0.25;
                    const apparelHeight = (apparelWidth * apparelImg.height) / apparelImg.width;
                    const apparelX = 20;
                    const apparelY = 20;
                    
                    // Add border to apparel
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(apparelX - 2, apparelY - 2, apparelWidth + 4, apparelHeight + 4);
                    
                    ctx.drawImage(apparelImg, apparelX, apparelY, apparelWidth, apparelHeight);
                    
                    // Add title
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 24px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('AI Generated Fashion Shoot', width / 2, 50);
                    
                    // Add subtitle
                    ctx.font = '16px Arial';
                    ctx.fillText('Model + Apparel Combination', width / 2, height - 40);
                    
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                }
            };
            
            modelImg.onload = onImageLoad;
            modelImg.onerror = () => reject(new Error('Failed to load model image'));
            modelImg.src = modelImage;
            
            apparelImg.onload = onImageLoad;
            apparelImg.onerror = () => reject(new Error('Failed to load apparel image'));
            apparelImg.src = apparelImage;
        });
    }
};
