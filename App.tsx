import React, { useState, useCallback } from 'react';
import { generatePrompt, generateImage, fileToBase64, editImageWithAnnotation } from './services/geminiService';
import { ASPECT_RATIOS, LIGHTING_STYLES, CAMERA_PERSPECTIVES } from './constants';
import type { ImageFile, Base64Image, HistoryItem } from './types';
import AnnotationEditor from './AnnotationEditor';
import PatternFixEditor from './PatternFixEditor';

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

const WandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v1.046a1 1 0 01.995 1.037 11.96 11.96 0 01-1.414 5.923A1 1 0 0111 10.046V11a1 1 0 01-1 1H9a1 1 0 01-1-1v-.954a1 1 0 01.586-.914 11.96 11.96 0 01-1.414-5.923A1 1 0 018 3.046V2a1 1 0 01.7-1.954l.328-.11A1 1 0 0110 0h.054a1 1 0 01.995.037l.25.086zM3 13.954a1 1 0 01.914-.586 11.96 11.96 0 015.923-1.414A1 1 0 0110 11.046V12a1 1 0 01-1 1H8a1 1 0 01-1-1v-.054a1 1 0 01.037-.995l.086-.25A1 1 0 016.046 9H5a1 1 0 01-1-1v-1a1 1 0 01.954-.7 11.96 11.96 0 015.923 1.414 1 1 0 01.914.586V8a1 1 0 01-1 1h-.954a1 1 0 01-.914-.586A11.96 11.96 0 014 3.046 1 1 0 014.954 2H5a1 1 0 011-1h1a1 1 0 011 1v1.046a1 1 0 01-.995 1.037A11.96 11.96 0 016.086 10a1 1 0 01-.586.914V11a1 1 0 011 1h.954a1 1 0 01.914.586 11.96 11.96 0 011.414 5.923A1 1 0 018.954 18H8a1 1 0 01-1-1v-1a1 1 0 01-.954-.7A11.96 11.96 0 01.171 10a1 1 0 01.586-.914V8a1 1 0 011-1h1a1 1 0 011 1v.954a1 1 0 01-.037.995l-.086.25A1 1 0 013.954 11H3a1 1 0 01-1 1v1a1 1 0 01.954.7z" clipRule="evenodd" />
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

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
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
  const [preserveBackground, setPreserveBackground] = useState<boolean>(false); // Default to false
  const [userIntent, setUserIntent] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState<boolean>(false);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [isAnnotationModalOpen, setIsAnnotationModalOpen] = useState<boolean>(false);
  const [isPatternFixModalOpen, setIsPatternFixModalOpen] = useState<boolean>(false);
  
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
    setIsLoadingPrompt(true);
    setError(null);
    
    try {
      let inputImageBase64: Base64Image | null = null;
      // Use the active (latest) image for iterative prompts, otherwise use the initial upload
      const isIterative = history.length > 0 && activeImageUrl;
      
      if (activeImageUrl) {
        inputImageBase64 = {
          data: activeImageUrl.split(',')[1],
          mimeType: activeImageUrl.match(/:(.*?);/)?.[1] || 'image/png',
        };
      } else if (productImage) {
        inputImageBase64 = await fileToBase64(productImage.file);
      }

      if (!inputImageBase64) {
        setError("Please upload a product photo or select an image from history to generate a prompt.");
        setIsLoadingPrompt(false);
        return;
      }

      const refImgBase64 = referenceImage ? await fileToBase64(referenceImage.file) : undefined;
      // If it's an iterative step, we pass the previous prompt. Otherwise, pass undefined.
      const previousPrompt = isIterative ? prompt : undefined;
      const newPrompt = await generatePrompt(inputImageBase64, userIntent, aspectRatio, lightingStyle, cameraPerspective, preserveBackground, refImgBase64, previousPrompt);
      setPrompt(newPrompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
      setPrompt('');
    } finally {
      setIsLoadingPrompt(false);
    }
  }, [activeImageUrl, productImage, userIntent, aspectRatio, lightingStyle, cameraPerspective, referenceImage, prompt, history, preserveBackground]);

  const handleGenerateImage = async () => {
    let inputImageBase64: Base64Image | null = null;
    if (activeImageUrl) {
        inputImageBase64 = {
            data: activeImageUrl.split(',')[1],
            mimeType: activeImageUrl.match(/:(.*?);/)?.[1] || 'image/png',
        };
    } else if (productImage) {
        inputImageBase64 = await fileToBase64(productImage.file);
    }

    if (!inputImageBase64) {
        setError("Please upload a product image or select a history image to generate a new one.");
        return;
    }
    if (!prompt) {
        setError("Please generate or write a prompt first.");
        return;
    }

    setIsLoadingImage(true);
    setError(null);

    try {
        const imageUrl = await generateImage(inputImageBase64, prompt, isHDUpscaleMode, preserveProduct, preserveBackground);
        const newHistoryItem: HistoryItem = { imageUrl, prompt };
        setHistory(prev => [newHistoryItem, ...prev]);
        setActiveImageUrl(imageUrl);
        setUserIntent(''); // Clear intent for the next iteration
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

  const handleAnnotationGenerate = async ({
    destinationMask,
    referenceImage,
    sourceMask,
    instruction,
  }: {
    destinationMask: Base64Image;
    referenceImage: Base64Image;
    sourceMask: Base64Image;
    instruction: string;
  }) => {
    if (!activeImageUrl) return;
    setIsLoadingImage(true);
    setIsAnnotationModalOpen(false);
    setError(null);

    try {
      const originalImageBase64: Base64Image = {
        data: activeImageUrl.split(',')[1],
        mimeType: activeImageUrl.match(/:(.*?);/)?.[1] || 'image/png',
      };

      const imageUrl = await editImageWithAnnotation(
        originalImageBase64,
        destinationMask,
        referenceImage,
        sourceMask,
        instruction
      );
      const newHistoryItem: HistoryItem = { imageUrl, prompt: `Edit: ${instruction}` };

      setHistory((prev) => [newHistoryItem, ...prev]);
      setActiveImageUrl(imageUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred during image editing.');
    } finally {
      setIsLoadingImage(false);
    }
  };
  
  const handlePatternFixSubmit = async ({ destinationMask, sourceMask }: { destinationMask: Base64Image; sourceMask: Base64Image; }) => {
    if (!activeImageUrl) return;
    setIsLoadingImage(true);
    setIsPatternFixModalOpen(false);
    setError(null);

    try {
      const imageBase64: Base64Image = {
        data: activeImageUrl.split(',')[1],
        mimeType: activeImageUrl.match(/:(.*?);/)?.[1] || 'image/png',
      };
      
      const instruction = "Analyze the source pattern identified by the blue mask. Inpaint the destination area (identified by the red mask) with this source pattern. Ensure a seamless, photorealistic blend, matching lighting, shadows, and texture.";

      const imageUrl = await editImageWithAnnotation(
        imageBase64,
        destinationMask,
        imageBase64, 
        sourceMask,
        instruction
      );
      const newHistoryItem: HistoryItem = { imageUrl, prompt: `Fix Pattern: Replaced area with texture from same image.` };

      setHistory((prev) => [newHistoryItem, ...prev]);
      setActiveImageUrl(imageUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred during pattern fixing.');
    } finally {
      setIsLoadingImage(false);
    }
  };

  const handleNewProject = () => {
    if (window.confirm("Are you sure you want to start a new project? This will clear your current settings and uploads, but your history will be preserved.")) {
      if (productImage?.previewUrl) {
          URL.revokeObjectURL(productImage.previewUrl);
      }
      if (referenceImage?.previewUrl) {
          URL.revokeObjectURL(referenceImage.previewUrl);
      }
      setProductImage(null);
      setReferenceImage(null);
      setAspectRatio(ASPECT_RATIOS[4]);
      setLightingStyle(LIGHTING_STYLES[1]);
      setCameraPerspective(CAMERA_PERSPECTIVES[5]);
      setIsHDUpscaleMode(true);
      setPreserveProduct(true);
      setPreserveBackground(false);
      setUserIntent('');
      setPrompt('');
      setActiveImageUrl(null);
      setError(null);
    }
  };


  const controlsDisabled = isLoadingImage || isLoadingPrompt;
  const isIterativeState = history.length > 0 && !!activeImageUrl;

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
          <div className="flex justify-between items-center border-b border-gray-700 pb-3">
            <h2 className="text-xl font-semibold text-gray-300">1. Upload & Configure</h2>
            <button
                onClick={handleNewProject}
                className="flex items-center text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-1.5 px-3 rounded-lg transition-colors"
                title="Start a new project"
            >
                <PlusIcon />
                New Project
            </button>
          </div>
          
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
                disabled={isLoadingImage}
              />
              <label htmlFor="preserve-product" className="font-medium text-gray-300">
                Preserve original product details
              </label>
            </div>
            <div className="flex items-center space-x-3 bg-gray-900/50 p-3 rounded-lg border border-gray-700">
              <input
                id="preserve-background"
                type="checkbox"
                checked={preserveBackground}
                onChange={(e) => setPreserveBackground(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                disabled={isLoadingImage}
              />
              <label htmlFor="preserve-background" className="font-medium text-gray-300">
                Preserve original background
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
              {isIterativeState ? `What's next? (e.g., "make it warmer")` : `What is your goal for this photo?`}
            </label>
            <textarea
              id="user-intent"
              rows={2}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 disabled:opacity-50"
              placeholder={isIterativeState ? "Describe your changes..." : "e.g., 'A shot for a luxury wedding collection'."}
              value={userIntent}
              onChange={e => setUserIntent(e.target.value)}
              disabled={isLoadingImage}
            />
          </div>

          <button
            onClick={triggerPromptGeneration}
            disabled={(!productImage && !activeImageUrl) || isLoadingPrompt || isLoadingImage}
            className="w-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200"
          >
            <SparklesIcon />
            {isIterativeState ? 'Generate Next Prompt' : 'Generate Creative Prompt'}
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
            disabled={isLoadingImage || (!productImage && !activeImageUrl) || !prompt}
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
          
          <div className="flex gap-4 mt-4">
            <button
                onClick={() => setIsAnnotationModalOpen(true)}
                disabled={!activeImageUrl || isLoadingImage}
                title={!activeImageUrl ? "Generate an image first to enable editing" : "Annotate and edit the current image"}
                className="flex-1 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200"
            >
                <EditIcon />
                Annotate & Edit
            </button>
            <button
                onClick={() => setIsPatternFixModalOpen(true)}
                disabled={!activeImageUrl || isLoadingImage}
                title={!activeImageUrl ? "Generate an image first to enable pattern fixing" : "Fix a pattern or texture using another part of the image"}
                className="flex-1 flex items-center justify-center bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200"
            >
                <WandIcon />
                Fix Pattern
            </button>
          </div>

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
        {isPatternFixModalOpen && activeImageUrl && (
            <PatternFixEditor 
                isOpen={isPatternFixModalOpen}
                onClose={() => setIsPatternFixModalOpen(false)}
                onSubmit={handlePatternFixSubmit}
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