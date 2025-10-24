import React, { useState, useCallback } from 'react';
import { generatePrompt, generateImage, fileToBase64, editImageWithAnnotation } from './services/geminiService';
import { ASPECT_RATIOS, LIGHTING_STYLES, CAMERA_PERSPECTIVES } from './constants';
import type { ImageFile, Base64Image, HistoryItem } from './types';
import AnnotationEditor from './AnnotationEditor';

const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h10a4 4 0 014 4v5a4 4 0 01-4 4h-2m-6 4h6m-3-4v4m-3-12h.01" />
  </svg>
);

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm6 2a1 1 0 011 1v1h1a1 1 0 010 2h-1v1a1 1 0 01-2 0V8h-1a1 1 0 010-2h1V5a1 1 0 011-1zm-3 8a1 1 0 011 1v1h1a1 1 0 010 2h-1v1a1 1 0 01-2 0v-1h-1a1 1 0 010-2h1v-1a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

const EditIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
    </svg>
);


const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface ImageUploaderProps {
  id: string;
  label: string;
  imageFile: ImageFile | null;
  onImageChange: (file: File | null) => void;
  disabled?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ id, label, imageFile, onImageChange, disabled }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageChange(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => e.preventDefault();
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageChange(e.dataTransfer.files[0]);
    }
  };
  
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
      <label
        htmlFor={id}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex justify-center items-center w-full h-48 px-6 pt-5 pb-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200
        ${disabled ? 'border-gray-700 bg-gray-800 cursor-not-allowed' : 'border-gray-600 hover:border-indigo-500 bg-gray-800'}`}
      >
        {imageFile ? (
          <img src={imageFile.previewUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded-md" />
        ) : (
          <div className="space-y-1 text-center">
            <UploadIcon />
            <div className="flex text-sm text-gray-500">
              <p className="pl-1">Upload a file or drag and drop</p>
            </div>
            <p className="text-xs text-gray-600">PNG, JPG, GIF up to 10MB</p>
          </div>
        )}
        <input id={id} name={id} type="file" className="sr-only" onChange={handleFileChange} accept="image/*" disabled={disabled} />
      </label>
    </div>
  );
};

export default function App() {
  const [productImage, setProductImage] = useState<ImageFile | null>(null);
  const [referenceImage, setReferenceImage] = useState<ImageFile | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>(ASPECT_RATIOS[4]); // Default to 9:16
  const [lightingStyle, setLightingStyle] = useState<string>(LIGHTING_STYLES[1]); // Default to Natural
  const [cameraPerspective, setCameraPerspective] = useState<string>(CAMERA_PERSPECTIVES[5]); // Default to Top-down flat lay
  const [isHDUpscaleMode, setIsHDUpscaleMode] = useState<boolean>(true); // Default to true
  const [preserveProduct, setPreserveProduct] = useState<boolean>(true); // Default to true
  const [userIntent, setUserIntent] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState<boolean>(false);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [isAnnotationModalOpen, setIsAnnotationModalOpen] = useState<boolean>(false);
  
  const handleImageChange = (setter: React.Dispatch<React.SetStateAction<ImageFile | null>>) => (file: File | null) => {
    setter(current => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      if (file) {
        return { file, previewUrl: URL.createObjectURL(file) };
      }
      return null;
    });
  };
  
  const triggerPromptGeneration = useCallback(async () => {
    if (!productImage) {
      setError("Please upload a product photo first to generate a relevant prompt.");
      return;
    }
    setIsLoadingPrompt(true);
    setError(null);
    
    try {
      const prodImgBase64 = await fileToBase64(productImage.file);
      const refImgBase64 = referenceImage ? await fileToBase64(referenceImage.file) : undefined;
      const newPrompt = await generatePrompt(prodImgBase64, userIntent, aspectRatio, lightingStyle, cameraPerspective, refImgBase64, prompt);
      setPrompt(newPrompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
      setPrompt('');
    } finally {
      setIsLoadingPrompt(false);
    }
  }, [productImage, userIntent, aspectRatio, lightingStyle, cameraPerspective, referenceImage, prompt]);

  const handleGenerateImage = async () => {
    if (!productImage || !prompt) {
      setError("Please upload a product image and generate a prompt first.");
      return;
    }
    setIsLoadingImage(true);
    setActiveImageUrl(null);
    setError(null);

    try {
      const productImageBase64 = await fileToBase64(productImage.file);
      const imageUrl = await generateImage(productImageBase64, prompt, isHDUpscaleMode, preserveProduct);
      const newHistoryItem: HistoryItem = { imageUrl, prompt };
      setHistory(prev => [newHistoryItem, ...prev]);
      setActiveImageUrl(imageUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred during image generation.');
    } finally {
      setIsLoadingImage(false);
    }
  };

  const handleHistoryClick = (item: HistoryItem) => {
    setActiveImageUrl(item.imageUrl);
    setPrompt(item.prompt);
  };

  const handleAnnotationGenerate = async ({ mask, instruction }: { mask: Base64Image, instruction: string }) => {
    if (!activeImageUrl) return;
    setIsLoadingImage(true);
    setIsAnnotationModalOpen(false);
    setError(null);

    try {
      const originalImageBase64: Base64Image = {
        data: activeImageUrl.split(',')[1],
        mimeType: activeImageUrl.match(/:(.*?);/)?.[1] || 'image/png'
      };

      const imageUrl = await editImageWithAnnotation(originalImageBase64, mask, instruction);
      const newHistoryItem: HistoryItem = { imageUrl, prompt: `Edit: ${instruction}` };
      
      setHistory(prev => [newHistoryItem, ...prev]);
      setActiveImageUrl(imageUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred during image editing.');
    } finally {
      setIsLoadingImage(false);
    }
  };


  const controlsDisabled = isLoadingImage || isLoadingPrompt;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex flex-col">
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
          AI Product Photo Studio
        </h1>
      </header>
      
      <main className="flex-grow container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Control Panel */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 flex flex-col gap-6 h-fit">
          <h2 className="text-xl font-semibold text-gray-300 border-b border-gray-700 pb-3">1. Upload & Configure</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ImageUploader id="product-image" label="Product Photo" imageFile={productImage} onImageChange={handleImageChange(setProductImage)} disabled={isLoadingImage} />
            <ImageUploader id="reference-image" label="Style Reference (Optional)" imageFile={referenceImage} onImageChange={handleImageChange(setReferenceImage)} disabled={isLoadingImage} />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center space-x-3 bg-gray-900/50 p-3 rounded-lg border border-gray-700">
              <input
                id="hd-upscale"
                type="checkbox"
                checked={isHDUpscaleMode}
                onChange={(e) => setIsHDUpscaleMode(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                disabled={isLoadingImage}
              />
              <label htmlFor="hd-upscale" className="font-medium text-gray-300">
                HD Photorealistic Upscale Mode
              </label>
            </div>
             <div className="flex items-center space-x-3 bg-gray-900/50 p-3 rounded-lg border border-gray-700">
              <input
                id="preserve-product"
                type="checkbox"
                checked={preserveProduct}
                onChange={(e) => setPreserveProduct(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                disabled={!isHDUpscaleMode || isLoadingImage}
              />
              <label htmlFor="preserve-product" className={`font-medium transition-colors ${!isHDUpscaleMode ? 'text-gray-500' : 'text-gray-300'}`}>
                Preserve original product details
              </label>
            </div>
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CustomSelect label="Aspect Ratio" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} options={ASPECT_RATIOS} disabled={isLoadingImage} />
            <CustomSelect label="Lighting Style" value={lightingStyle} onChange={e => setLightingStyle(e.target.value)} options={LIGHTING_STYLES} disabled={isLoadingImage} />
            <CustomSelect label="Camera Perspective" value={cameraPerspective} onChange={e => setCameraPerspective(e.target.value)} options={CAMERA_PERSPECTIVES} disabled={isLoadingImage} />
          </div>
          
          <div>
            <label htmlFor="user-intent" className="block text-sm font-medium text-gray-400 mb-2">
              {prompt ? `What's next? (e.g., "make it warmer")` : `What is your goal for this photo?`}
            </label>
            <textarea
              id="user-intent"
              rows={2}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 disabled:opacity-50"
              placeholder={prompt ? "Describe your changes..." : "e.g., 'A shot for a luxury wedding collection'."}
              value={userIntent}
              onChange={e => setUserIntent(e.target.value)}
              disabled={isLoadingImage}
            />
          </div>

          <button
            onClick={triggerPromptGeneration}
            disabled={!productImage || isLoadingPrompt || isLoadingImage}
            className="w-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200"
          >
            <SparklesIcon />
            {prompt ? 'Generate Next Prompt' : 'Generate Creative Prompt'}
          </button>

          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-400 mb-2">
              Image Prompt
            </label>
            <div className="relative">
              <textarea
                id="prompt"
                rows={5}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 disabled:opacity-50"
                placeholder={isLoadingPrompt ? "Generating creative prompt..." : "Click 'Generate Creative Prompt' or write your own."}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                disabled={controlsDisabled}
              />
              {isLoadingPrompt && <div className="absolute top-3 right-3 h-5 w-5 border-2 border-t-transparent border-indigo-400 rounded-full animate-spin"></div>}
            </div>
          </div>
          
          <button
            onClick={handleGenerateImage}
            disabled={isLoadingImage || !productImage || !prompt}
            className="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 text-lg"
          >
            {isLoadingImage ? (
              <>
                <div className="h-5 w-5 mr-3 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                Generating Image...
              </>
            ) : "Generate Image"}
          </button>

          {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg text-sm">{error}</div>}
        </div>

        {/* Output Panel */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 flex flex-col">
          <h2 className="text-xl font-semibold text-gray-300 border-b border-gray-700 pb-3 mb-6">2. Generated Image</h2>
          <div className="flex-grow flex flex-col items-center justify-center bg-gray-900/50 rounded-lg aspect-square">
            {isLoadingImage && !activeImageUrl ? (
               <div className="text-center text-gray-400">
                <div className="h-12 w-12 mx-auto mb-4 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin"></div>
                <p className="font-semibold">Creating your masterpiece...</p>
                <p className="text-sm text-gray-500">This can take a moment.</p>
              </div>
            ) : activeImageUrl ? (
              <div onClick={() => setIsLightboxOpen(true)} className="cursor-pointer group relative w-full h-full flex items-center justify-center">
                <img src={activeImageUrl} alt="Generated" className="max-h-full max-w-full object-contain rounded-md" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-md">
                  <p className="text-white font-semibold">Click to view larger</p>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <p className="text-lg">Your generated image will appear here</p>
              </div>
            )}
          </div>
          
          <button
              onClick={() => setIsAnnotationModalOpen(true)}
              disabled={!activeImageUrl || isLoadingImage}
              title={!activeImageUrl ? "Generate an image first to enable editing" : "Annotate and edit the current image"}
              className="w-full mt-4 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200"
          >
              <EditIcon />
              Annotate & Edit
          </button>

          {history.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <h3 className="text-lg font-semibold text-gray-300 mb-4">Generation History</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                {history.map((item, index) => (
                  <div
                    key={index}
                    className="relative group cursor-pointer aspect-square"
                    onClick={() => handleHistoryClick(item)}
                    aria-label={`Select history item ${index + 1}`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={`History item ${index + 1}`}
                      className="w-full h-full object-cover rounded-md"
                    />
                    <div
                      className={`absolute inset-0 rounded-md transition-all duration-200 ring-2 ring-offset-2 ring-offset-gray-800
                        ${item.imageUrl === activeImageUrl ? 'ring-indigo-500' : 'ring-transparent group-hover:ring-indigo-500/50'}`}
                    ></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {isLightboxOpen && activeImageUrl && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setIsLightboxOpen(false)}
          >
            <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <img src={activeImageUrl} alt="Generated Fullscreen" className="w-full h-full object-contain rounded-lg shadow-2xl" />
              <div className="absolute -top-12 right-0 flex gap-3">
                 <a
                  href={activeImageUrl}
                  download="ai-generated-photo.png"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 flex items-center shadow-lg"
                >
                  <DownloadIcon /> Download
                </a>
                <button
                  onClick={() => setIsLightboxOpen(false)}
                  className="bg-gray-800/80 hover:bg-gray-700/80 text-white p-2 rounded-full transition-all duration-200 shadow-lg"
                  aria-label="Close"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
          </div>
        )}
        {isAnnotationModalOpen && activeImageUrl && (
            <AnnotationEditor 
                isOpen={isAnnotationModalOpen}
                onClose={() => setIsAnnotationModalOpen(false)}
                onSubmit={handleAnnotationGenerate}
                imageUrl={activeImageUrl}
            />
        )}
      </main>
    </div>
  );
}

interface CustomSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: string[];
}

const CustomSelect: React.FC<CustomSelectProps> = ({ label, options, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
    <select
      {...props}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 disabled:opacity-50"
    >
      {options.map(option => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </div>
);