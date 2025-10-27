import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Base64Image } from './types';

// --- ICONS ---
const BrushIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const EraserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 000-2.828l-7-7a2 2 0 00-2.828 0l-7 7a2 2 0 002.828 2.828l7-7 7 7zM5 18a1 1 0 001 1h12a1 1 0 001-1v-1H5v1z" /></svg>;
const UndoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6-6m-6 6l6 6" /></svg>;
const RedoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" /></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;

const DESTINATION_COLOR = '#ef4444'; // Red-500
const SOURCE_COLOR = '#3b82f6';      // Blue-500

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
        if (!canvas || !image || !container || !image.complete || image.naturalWidth === 0) return;

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

        if (canvas.width !== newWidth || canvas.height !== newHeight) {
            // Save the current drawing before resizing
            const currentDrawing = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);

            canvas.width = newWidth;
            canvas.height = newHeight;

            // Restore the drawing if it existed
            if (currentDrawing && currentDrawing.width > 0 && currentDrawing.height > 0) {
                // Create a temporary canvas to hold the old drawing
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = currentDrawing.width;
                tempCanvas.height = currentDrawing.height;
                tempCanvas.getContext('2d')?.putImageData(currentDrawing, 0, 0);

                // Draw the old drawing onto the new canvas, scaling it to fit
                canvas.getContext('2d')?.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
            }
        }
    }, [canvasRef]);

    useEffect(() => {
        const image = imageRef.current;
        const handleLoad = () => resizeCanvas();
        image?.addEventListener('load', handleLoad);
        if (image?.complete) handleLoad();
        
        const observer = new ResizeObserver(resizeCanvas);
        if (containerRef.current) observer.observe(containerRef.current);

        return () => {
            image?.removeEventListener('load', handleLoad);
            observer.disconnect();
        };
    }, [imageSrc, resizeCanvas]);

    return (
        <div ref={containerRef} className="flex-grow w-full h-full relative flex items-center justify-center bg-black/20 rounded-md overflow-hidden">
            <img ref={imageRef} src={imageSrc} alt="Annotation subject" className="max-w-full max-h-full object-contain pointer-events-none" />
            <canvas ref={canvasRef} className="absolute cursor-crosshair z-10" onMouseDown={onDrawStart} onMouseMove={onDrawing} onMouseUp={onDrawEnd} onMouseLeave={onDrawEnd} />
        </div>
    );
};


interface PatternFixEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { destinationMask: Base64Image; sourceMask: Base64Image }) => void;
  imageUrl: string;
}

const PatternFixEditor: React.FC<PatternFixEditorProps> = ({ isOpen, onClose, onSubmit, imageUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  
  const history = useRef<ImageData[]>([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const destinationMaskData = useRef<ImageData | null>(null);

  const [step, setStep] = useState<'destination' | 'source'>('destination');
  const [brushSize, setBrushSize] = useState(30);
  const [mode, setMode] = useState<'brush' | 'eraser'>('brush');
  const activeColor = step === 'destination' ? DESTINATION_COLOR : SOURCE_COLOR;

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (historyPointer < history.current.length - 1) {
      history.current.splice(historyPointer + 1);
    }
    history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    setHistoryPointer(history.current.length - 1);
  }, [historyPointer]);
  
  const clearCanvasAndHistory = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const blankState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      history.current = [blankState];
      setHistoryPointer(0);
  }, []);

  useEffect(() => {
    if (isOpen) {
        setStep('destination');
        destinationMaskData.current = null;
        setTimeout(clearCanvasAndHistory, 50); // Delay to allow canvas to mount
    }
  }, [isOpen, clearCanvasAndHistory]);
  
  const undo = () => {
    if (historyPointer > 0) {
      const newPointer = historyPointer - 1;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.putImageData(history.current[newPointer], 0, 0);
        setHistoryPointer(newPointer);
      }
    }
  };

  const redo = () => {
    if (historyPointer < history.current.length - 1) {
      const newPointer = historyPointer + 1;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.putImageData(history.current[newPointer], 0, 0);
        setHistoryPointer(newPointer);
      }
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
    ctx.strokeStyle = activeColor;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
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
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.closePath();
    isDrawing.current = false;
    saveHistory();
  };

  const handleNext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    destinationMaskData.current = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    clearCanvasAndHistory();
    setStep('source');
  };

  const handleBack = () => {
    const canvas = canvasRef.current;
    if (!canvas || !destinationMaskData.current) return;
    clearCanvasAndHistory();
    canvas.getContext('2d')!.putImageData(destinationMaskData.current, 0, 0);
    saveHistory(); // Save restored state as first history item
    setStep('destination');
  };

  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !destinationMaskData.current) return;

    const sourceMask = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;

    tempCtx.putImageData(destinationMaskData.current, 0, 0);
    const destMaskDataUrl = tempCanvas.toDataURL('image/png');

    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.putImageData(sourceMask, 0, 0);
    const sourceMaskDataUrl = tempCanvas.toDataURL('image/png');
    
    onSubmit({
        destinationMask: { data: destMaskDataUrl.split(',')[1], mimeType: 'image/png' },
        sourceMask: { data: sourceMaskDataUrl.split(',')[1], mimeType: 'image/png' },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-4xl h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-200">Fix Pattern Tool</h2>
            <p className="text-sm text-gray-400">
                {step === 'destination'
                    ? <>Step 1: Mask the area you want to <span className="text-red-400 font-bold">REPLACE</span>.</>
                    : <>Step 2: Mask the pattern you want to <span className="text-blue-400 font-bold">COPY</span>.</>
                }
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"><CloseIcon /></button>
        </div>
        
        {/* Main Content */}
        <div className="flex-grow min-h-0 p-4">
            <AnnotatedImage imageSrc={imageUrl} canvasRef={canvasRef} onDrawStart={startDrawing} onDrawing={draw} onDrawEnd={stopDrawing} />
        </div>

        {/* Footer (Controls) */}
        <div className="flex-shrink-0 p-4 border-t border-gray-700 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex w-full sm:w-auto items-center justify-center flex-wrap gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700">
                <button onClick={() => setMode('brush')} title="Brush" className={`p-2 rounded-md ${mode === 'brush' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}><BrushIcon/></button>
                <button onClick={() => setMode('eraser')} title="Eraser" className={`p-2 rounded-md ${mode === 'eraser' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}><EraserIcon/></button>
                <div className="h-6 w-px bg-gray-700 mx-1"></div>
                <button onClick={undo} disabled={historyPointer <= 0} title="Undo" className="p-2 rounded-md text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"><UndoIcon/></button>
                <button onClick={redo} disabled={historyPointer >= history.current.length - 1} title="Redo" className="p-2 rounded-md text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"><RedoIcon/></button>
                <div className="h-6 w-px bg-gray-700 mx-1"></div>
                <input type="range" min="5" max="100" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-24 accent-indigo-500" title={`Brush Size: ${brushSize}`} />
            </div>
            <div className="flex w-full sm:w-auto gap-4">
                {step === 'source' && (
                    <button onClick={handleBack} className="flex-1 sm:flex-none bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">Back</button>
                )}
                {step === 'destination' ? (
                    <button onClick={handleNext} className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">Next</button>
                ) : (
                    <button onClick={handleSubmit} className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">Generate</button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default PatternFixEditor;