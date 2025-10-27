import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ImageFile, Base64Image } from './types';

// --- ICONS ---
const BrushIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const EraserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 000-2.828l-7-7a2 2 0 00-2.828 0l-7 7a2 2 0 002.828 2.828l7-7 7 7zM5 18a1 1 0 001 1h12a1 1 0 001-1v-1H5v1z" /></svg>;
const UndoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6-6m-6 6l6 6" /></svg>;
const RedoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" /></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h10a4 4 0 014 4v5a4 4 0 01-4 4h-2m-6 4h6m-3-4v4m-3-12h.01" /></svg>;
const DuplicateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" /><path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h6a2 2 0 00-2-2H5z" /></svg>;

const DESTINATION_COLOR = '#ef4444'; // Red
const SOURCE_COLOR = '#3b82f6';      // Blue

// --- Helper to convert Data URL to File ---
const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type });
};

// --- Helper to convert File to Base64Image ---
const fileToBase64 = (file: File): Promise<Base64Image> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve({ data: base64Data, mimeType: file.type });
    };
    reader.onerror = (error) => reject(error);
  });
};

interface AnnotatedImageProps {
  imageSrc: string;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onDrawStart: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onDrawing: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onDrawEnd: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

const AnnotatedImage: React.FC<AnnotatedImageProps> = ({ imageSrc, canvasRef, onDrawStart, onDrawing, onDrawEnd }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        const container = containerRef.current;
        if (!canvas || !image || !container) return;

        const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
        if (containerWidth === 0 || containerHeight === 0) return;

        const { naturalWidth, naturalHeight } = image;
        const aspectRatio = naturalWidth / naturalHeight;

        let newWidth = containerWidth;
        let newHeight = newWidth / aspectRatio;

        if (newHeight > containerHeight) {
            newHeight = containerHeight;
            newWidth = newHeight * aspectRatio;
        }

        const currentDrawing = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);

        canvas.width = newWidth;
        canvas.height = newHeight;
        
        if (currentDrawing && currentDrawing.width > 0 && currentDrawing.height > 0) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = currentDrawing.width;
            tempCanvas.height = currentDrawing.height;
            tempCanvas.getContext('2d')?.putImageData(currentDrawing, 0, 0);

            canvas.getContext('2d')?.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
        }

    }, [canvasRef]);

    useEffect(() => {
        const image = imageRef.current;
        const container = containerRef.current;
        if (!image || !container) return;

        const observer = new ResizeObserver(resizeCanvas);
        observer.observe(container);

        image.onload = resizeCanvas;
        if (image.complete) {
            resizeCanvas();
        }

        return () => {
            observer.disconnect();
            if (image) {
                image.onload = null;
            }
        };
    }, [imageSrc, resizeCanvas]);


    return (
        <div ref={containerRef} className="flex-grow w-full h-full relative flex items-center justify-center bg-black/20 rounded-md overflow-hidden">
            <img ref={imageRef} src={imageSrc} alt="Annotation subject" className="max-w-full max-h-full object-contain pointer-events-none" />
            <canvas
                ref={canvasRef}
                className="absolute cursor-crosshair z-10"
                onMouseDown={onDrawStart}
                onMouseMove={onDrawing}
                onMouseUp={onDrawEnd}
                onMouseLeave={onDrawEnd}
            />
        </div>
    );
};

interface AnnotationEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { destinationMask: Base64Image; referenceImage: Base64Image; sourceMask: Base64Image; instruction: string }) => void;
  imageUrl: string;
}

const AnnotationEditor: React.FC<AnnotationEditorProps> = ({ isOpen, onClose, onSubmit, imageUrl }) => {
  const destCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const isDrawing = useRef(false);
  const destHistory = useRef<ImageData[]>([]);
  const sourceHistory = useRef<ImageData[]>([]);
  const [destHistoryPointer, setDestHistoryPointer] = useState(-1);
  const [sourceHistoryPointer, setSourceHistoryPointer] = useState(-1);

  const [brushSize, setBrushSize] = useState(30);
  const [mode, setMode] = useState<'brush' | 'eraser'>('brush');
  const [instruction, setInstruction] = useState('');
  const [activeEditor, setActiveEditor] = useState<'destination' | 'source'>('destination');
  const [referenceImage, setReferenceImage] = useState<ImageFile | null>(null);
  
  const getActiveCanvasState = useCallback(() => {
    return activeEditor === 'destination'
      ? { canvasRef: destCanvasRef, history: destHistory, pointer: destHistoryPointer, setPointer: setDestHistoryPointer, color: DESTINATION_COLOR }
      : { canvasRef: sourceCanvasRef, history: sourceHistory, pointer: sourceHistoryPointer, setPointer: setSourceHistoryPointer, color: SOURCE_COLOR };
  }, [activeEditor, destHistoryPointer, sourceHistoryPointer]);

  const saveHistory = useCallback(() => {
    const { canvasRef, history, pointer, setPointer } = getActiveCanvasState();
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (pointer < history.current.length - 1) {
      history.current.splice(pointer + 1);
    }
    
    history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    setPointer(history.current.length - 1);
  }, [getActiveCanvasState]);

  const clearCanvasAndHistory = (canvasRef: React.RefObject<HTMLCanvasElement>, history: React.MutableRefObject<ImageData[]>, setPointer: React.Dispatch<React.SetStateAction<number>>) => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const blankState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      history.current = [blankState];
      setPointer(0);
  };

  useEffect(() => {
    if (isOpen) {
        setTimeout(() => {
            clearCanvasAndHistory(destCanvasRef, destHistory, setDestHistoryPointer);
            if (referenceImage) {
                clearCanvasAndHistory(sourceCanvasRef, sourceHistory, setSourceHistoryPointer);
            } else {
                 sourceHistory.current = [];
                 setSourceHistoryPointer(-1);
            }
        }, 100);
    } else {
        setInstruction('');
        if (referenceImage?.previewUrl) URL.revokeObjectURL(referenceImage.previewUrl);
        setReferenceImage(null);
        setActiveEditor('destination');
        setBrushSize(30);
        setMode('brush');
    }
  }, [isOpen, referenceImage]);
  
  const undo = () => {
    const { canvasRef, history, pointer, setPointer } = getActiveCanvasState();
    if (pointer > 0) {
      const newPointer = pointer - 1;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.putImageData(history.current[newPointer], 0, 0);
        setPointer(newPointer);
      }
    }
  };

  const redo = () => {
    const { canvasRef, history, pointer, setPointer } = getActiveCanvasState();
    if (pointer < history.current.length - 1) {
      const newPointer = pointer + 1;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.putImageData(history.current[newPointer], 0, 0);
        setPointer(newPointer);
      }
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { canvasRef, color } = getActiveCanvasState();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawing.current = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.globalCompositeOperation = mode === 'brush' ? 'source-over' : 'destination-out';
    ctx.strokeStyle = color;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const { canvasRef } = getActiveCanvasState();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x,y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    const { canvasRef } = getActiveCanvasState();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.closePath();
    isDrawing.current = false;
    saveHistory();
  };

  const handleRefImageChange = (file: File | null) => {
    if (referenceImage?.previewUrl) {
      URL.revokeObjectURL(referenceImage.previewUrl);
    }
    if (file) {
      setReferenceImage({ file, previewUrl: URL.createObjectURL(file) });
      setActiveEditor('source');
    } else {
      setReferenceImage(null);
    }
  };

  const handleUseSourceAsRef = async () => {
    const file = await dataUrlToFile(imageUrl, 'source-reference.png');
    handleRefImageChange(file);
  };
  
  const handleSubmit = async () => {
    if (!destCanvasRef.current || !sourceCanvasRef.current || !referenceImage?.file) {
        alert("Please provide and annotate both a destination and a source image.");
        return;
    }
    if (!instruction.trim()) {
        alert("Please write an instruction for the edit.");
        return;
    }

    const refImageBase64 = fileToBase64(referenceImage.file);
    const destMaskDataUrl = destCanvasRef.current.toDataURL('image/png');
    const sourceMaskDataUrl = sourceCanvasRef.current.toDataURL('image/png');
    
    onSubmit({
        destinationMask: { data: destMaskDataUrl.split(',')[1], mimeType: 'image/png' },
        referenceImage: await refImageBase64,
        sourceMask: { data: sourceMaskDataUrl.split(',')[1], mimeType: 'image/png' },
        instruction
    });
  };

  const { pointer: activePointer, history: activeHistory } = getActiveCanvasState();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-7xl h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-gray-200">Reference-Based Editing</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"><CloseIcon /></button>
        </div>
        
        {/* Main Content (Image Panels) */}
        <div className="flex-grow min-h-0 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Destination Panel */}
            <div className={`flex flex-col gap-2 p-2 rounded-lg border-2 transition-colors ${activeEditor === 'destination' ? 'border-indigo-500' : 'border-gray-700'}`}>
                <h3 className="text-center font-semibold cursor-pointer select-none text-gray-300" onClick={() => setActiveEditor('destination')}>
                    1. Destination: <span className="text-red-400 font-bold">Mask Area to Replace</span>
                </h3>
                <AnnotatedImage imageSrc={imageUrl} canvasRef={destCanvasRef} onDrawStart={startDrawing} onDrawing={draw} onDrawEnd={stopDrawing} />
            </div>

            {/* Source Panel */}
            <div className={`flex flex-col gap-2 p-2 rounded-lg border-2 transition-colors ${activeEditor === 'source' ? 'border-indigo-500' : 'border-gray-700'}`}>
                <h3 className={`text-center font-semibold select-none text-gray-300 ${referenceImage ? 'cursor-pointer' : ''}`} onClick={() => referenceImage && setActiveEditor('source')}>
                    2. Source: <span className="text-blue-400 font-bold">Mask Pattern to Copy</span>
                </h3>
                {!referenceImage ? (
                    <div className='flex-grow flex flex-col items-center justify-center text-center space-y-4 p-4'>
                        <label htmlFor="reference-upload" className="cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-600 rounded-lg hover:border-indigo-500 transition-colors w-full max-w-xs">
                            <UploadIcon />
                            <span className='mt-2 text-sm text-gray-400'>Upload Reference</span>
                            <input type="file" id="reference-upload" className="sr-only" accept="image/*" onChange={(e) => handleRefImageChange(e.target.files?.[0] || null)} />
                        </label>
                        <span className="text-gray-500">or</span>
                        <button onClick={handleUseSourceAsRef} className="flex items-center justify-center w-full max-w-xs bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2.5 px-3 rounded-lg transition-colors">
                           <DuplicateIcon /> Use Destination Image
                        </button>
                    </div>
                ) : (
                    <AnnotatedImage imageSrc={referenceImage.previewUrl} canvasRef={sourceCanvasRef} onDrawStart={startDrawing} onDrawing={draw} onDrawEnd={stopDrawing} />
                )}
            </div>
        </div>

        {/* Footer (Controls) */}
        <div className="flex-shrink-0 p-4 border-t border-gray-700 flex flex-col lg:flex-row gap-4 items-start lg:items-center">
             <div className="w-full lg:flex-1">
                <label htmlFor="instruction-input" className="block text-sm font-medium text-gray-400 mb-2">3. Editing Instructions</label>
                <textarea 
                    id="instruction-input"
                    rows={2} 
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-300 focus:ring-2 focus:ring-indigo-500" 
                    placeholder="e.g., 'Replace the logo with the floral pattern.'" 
                    value={instruction} 
                    onChange={e => setInstruction(e.target.value)} 
                />
            </div>
            <div className="w-full lg:w-auto flex flex-col sm:flex-row flex-shrink-0 items-center gap-4">
                <div className="flex w-full sm:w-auto items-center justify-center flex-wrap gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700">
                    <button onClick={() => setMode('brush')} title="Brush" className={`p-2 rounded-md ${mode === 'brush' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}><BrushIcon/></button>
                    <button onClick={() => setMode('eraser')} title="Eraser" className={`p-2 rounded-md ${mode === 'eraser' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}><EraserIcon/></button>
                    <div className="h-6 w-px bg-gray-700 mx-1"></div>
                    <button onClick={undo} disabled={activePointer <= 0} title="Undo" className="p-2 rounded-md text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"><UndoIcon/></button>
                    <button onClick={redo} disabled={!activeHistory.current || activePointer >= activeHistory.current.length - 1} title="Redo" className="p-2 rounded-md text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"><RedoIcon/></button>
                    <div className="h-6 w-px bg-gray-700 mx-1"></div>
                    <input type="range" min="5" max="100" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-24 accent-indigo-500" title={`Brush Size: ${brushSize}`} />
                </div>
                <button 
                    onClick={handleSubmit} 
                    disabled={!referenceImage || !instruction.trim()} 
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-indigo-900 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                    Generate
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotationEditor;
