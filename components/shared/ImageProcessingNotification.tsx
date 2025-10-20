import React from 'react';
import { Loader2, Image, CheckCircle } from 'lucide-react';

interface ImageProcessingNotificationProps {
    isVisible: boolean;
    message: string;
    progress?: number;
    isComplete?: boolean;
}

export const ImageProcessingNotification: React.FC<ImageProcessingNotificationProps> = ({
    isVisible,
    message,
    progress = 0,
    isComplete = false
}) => {
    if (!isVisible) return null;

    return (
        <div className="fixed top-20 right-4 z-50 bg-zinc-900 border border-violet-500/30 rounded-lg p-4 shadow-xl backdrop-blur-sm max-w-sm">
            <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                    {isComplete ? (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                        <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                        {message}
                    </p>
                    {!isComplete && progress > 0 && (
                        <div className="mt-2">
                            <div className="w-full bg-zinc-700 rounded-full h-2">
                                <div 
                                    className="bg-violet-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-zinc-400 mt-1">
                                {Math.round(progress)}% complete
                            </p>
                        </div>
                    )}
                </div>
                <Image className="w-5 h-5 text-violet-400 flex-shrink-0" />
            </div>
        </div>
    );
};
