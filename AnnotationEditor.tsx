import React, { useRef, useEffect, useState, useCallback } from 'react';

const BrushIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const EraserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 000-2.828l-7-7a2 2 0 00-2.828 0l-7 7a2 2 0 002.828 2.828l7-7 7 7zM5 18a1 1 0 001 1h12a1 1 0 001-1v-1H5v1z" /></svg>;
const UndoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6-6m-6 6l6 6" /></svg>;
const RedoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" /></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;

interface AnnotationEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { mask: { data: string; mimeType: string }, instruction: string }) => void;
  imageUrl: string;
}

const AnnotationEditor: React.FC<AnnotationEditorProps> = ({ isOpen, onClose, onSubmit, imageUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawing = useRef(false);
  const history = useRef<ImageData[]>([]);
  // Use a state to track history changes to update UI (e.g., disable/enable buttons)
  const [historyPointer, setHistoryPointer] = useState(-1);

  const [brushSize, setBrushSize] = useState(30);
  const [mode, setMode] = useState<'brush' | 'eraser'>('brush');
  const [instruction, setInstruction] = useState('');

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    
    // If we have undone, and then draw, we clear the "redo" history
    if (historyPointer < history.current.length - 1) {
      history.current = history.current.slice(0, historyPointer + 1);
    }
    
    history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    setHistoryPointer(prev => prev + 1);
  }, [historyPointer]);


  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imageUrl;
    image.onload = () => {
      const container = canvas.parentElement;
      if (container) {
        const { width, height } = container.getBoundingClientRect();
        const aspectRatio = image.naturalWidth / image.naturalHeight;
        let newWidth = width;
        let newHeight = width / aspectRatio;

        if (newHeight > height) {
          newHeight = height;
          newWidth = height * aspectRatio;
        }
        canvas.width = newWidth;
        canvas.height = newHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          contextRef.current = ctx;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Save the initial clear state
          history.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
          setHistoryPointer(0);
        }
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    if (isOpen) {
      initializeCanvas();
      window.addEventListener('resize', initializeCanvas);
    } else {
        // Reset state on close
        setInstruction('');
        setBrushSize(30);
        setMode('brush');
    }
    return () => {
      window.removeEventListener('resize', initializeCanvas);
    };
  }, [isOpen, initializeCanvas]);

  const undo = () => {
    if (historyPointer > 0) {
      const newPointer = historyPointer - 1;
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      if(canvas && ctx) {
        ctx.putImageData(history.current[newPointer], 0, 0);
        setHistoryPointer(newPointer);
      }
    }
  };

  const redo = () => {
    if (historyPointer < history.current.length - 1) {
      const newPointer = historyPointer + 1;
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      if(canvas && ctx) {
        ctx.putImageData(history.current[newPointer], 0, 0);
        setHistoryPointer(newPointer);
      }
    }
  };

  const startDrawing = ({ nativeEvent }: React.MouseEvent<HTMLCanvasElement>) => {
    const { offsetX, offsetY } = nativeEvent;
    const ctx = contextRef.current;
    if (!ctx) return;

    isDrawing.current = true;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.globalCompositeOperation = mode === 'brush' ? 'source-over' : 'destination-out';
    ctx.strokeStyle = '#ef4444'; // Red brush color
  };

  const draw = ({ nativeEvent }: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const { offsetX, offsetY } = nativeEvent;
    const ctx = contextRef.current;
    if (!ctx) return;
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    const ctx = contextRef.current;
    if (!ctx || !isDrawing.current) return;
    ctx.closePath();
    isDrawing.current = false;
    saveHistory();
  };
  
  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas || !instruction.trim()) {
        alert("Please write an instruction for the edit.");
        return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];
    onSubmit({
        mask: { data: base64Data, mimeType: 'image/png' },
        instruction
    });
  };

  if (!isOpen) return null;

  const canUndo = historyPointer > 0;
  const canRedo = historyPointer < history.current.length - 1;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-4xl h-[90vh] flex flex-col p-4 gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-200">Annotate & Edit Image</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"><CloseIcon /></button>
        </div>
        
        <div className="flex-grow min-h-0 flex items-center justify-center relative">
            <img src={imageUrl} alt="background" className="max-w-full max-h-full object-contain" />
            <canvas
                ref={canvasRef}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
            />
        </div>

        <div className="flex-shrink-0 flex flex-col md:flex-row gap-4">
          <div className="flex-grow flex flex-col gap-2">
            <label htmlFor="instruction" className="text-sm font-medium text-gray-400">Editing Instruction</label>
            <textarea
              id="instruction"
              rows={2}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-300 focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Remove the design in the marked area..."
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-400">Tools</span>
            <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700">
                <button onClick={() => setMode('brush')} className={`p-2 rounded-md ${mode === 'brush' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}><BrushIcon/></button>
                <button onClick={() => setMode('eraser')} className={`p-2 rounded-md ${mode === 'eraser' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}><EraserIcon/></button>
                <button onClick={undo} disabled={!canUndo} className="p-2 rounded-md text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"><UndoIcon/></button>
                <button onClick={redo} disabled={!canRedo} className="p-2 rounded-md text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"><RedoIcon/></button>
                <input type="range" min="5" max="100" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-24" />
            </div>
          </div>
        </div>

        <button onClick={handleSubmit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
            Generate Edited Image
        </button>
      </div>
    </div>
  );
};

export default AnnotationEditor;
