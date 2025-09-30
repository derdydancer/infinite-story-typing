import React from 'react';

interface ImageViewerProps {
  imageUrl: string | null;
  isLoading: boolean;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, isLoading }) => {
  return (
    <div className="w-full max-w-4xl mx-auto my-8">
        <h2 className="text-2xl font-bold text-slate-400 mb-4 text-center tracking-wider">Scene</h2>
        <div className="aspect-video bg-slate-800/70 rounded-lg border border-slate-700 flex items-center justify-center overflow-hidden transition-all duration-300">
            {isLoading && (
                <div className="flex flex-col items-center text-slate-500">
                    <svg className="animate-spin h-8 w-8 text-cyan-400 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Illustrating the scene...</span>
                </div>
            )}
            {!isLoading && imageUrl && (
                <img 
                    src={imageUrl} 
                    alt="AI generated scene from the story" 
                    className="w-full h-full object-cover animate-fade-in"
                    style={{ animation: 'fade-in 0.5s ease-in-out' }}
                />
            )}
            {!isLoading && !imageUrl && (
                <div className="text-center text-slate-500 p-4">
                    <p>An image of the story will appear here once the first scene is written.</p>
                </div>
            )}
        </div>
        <style>{`
            @keyframes fade-in {
                0% { opacity: 0; }
                100% { opacity: 1; }
            }
            .animate-fade-in {
                animation: fade-in 0.5s ease-in-out;
            }
        `}</style>
    </div>
  );
};

export default ImageViewer;
