/**
 * SIGNATURE PAD COMPONENT
 * 
 * Canvas-based digital signature pad for capturing handwritten signatures.
 * Used for contract signing workflows.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Trash2, Undo } from 'lucide-react';

interface SignaturePadProps {
  onChange?: (signatureDataUrl: string | null) => void;
  width?: number;
  height?: number;
  className?: string;
  penColor?: string;
  backgroundColor?: string;
  disabled?: boolean;
}

export function SignaturePad({
  onChange,
  width = 400,
  height = 200,
  className,
  penColor = '#000000',
  backgroundColor = '#ffffff',
  disabled = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(width);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const strokeHistory = useRef<ImageData[]>([]);

  // Responsive sizing
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        setCanvasWidth(Math.min(containerWidth - 2, width)); // -2 for border
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [width]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = height;

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set drawing styles
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [canvasWidth, height, penColor, backgroundColor]);

  const getPoint = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const saveStroke = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    strokeHistory.current.push(imageData);
    // Keep only last 20 strokes for undo
    if (strokeHistory.current.length > 20) {
      strokeHistory.current.shift();
    }
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();

    const point = getPoint(e);
    lastPoint.current = point;
    setIsDrawing(true);

    // Save current state for undo
    saveStroke();
  }, [disabled, saveStroke]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastPoint.current) return;

    const point = getPoint(e);

    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    lastPoint.current = point;
  }, [isDrawing, disabled]);

  const stopDrawing = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPoint.current = null;
      setHasSignature(true);

      // Emit signature data
      const canvas = canvasRef.current;
      if (canvas && onChange) {
        const dataUrl = canvas.toDataURL('image/png');
        onChange(dataUrl);
      }
    }
  }, [isDrawing, onChange]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    strokeHistory.current = [];
    onChange?.(null);
  }, [backgroundColor, onChange]);

  const handleUndo = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || strokeHistory.current.length === 0) return;

    const lastState = strokeHistory.current.pop();
    if (lastState) {
      ctx.putImageData(lastState, 0, 0);
      
      // Check if canvas is empty (only background)
      const isEmpty = strokeHistory.current.length === 0;
      setHasSignature(!isEmpty);
      
      if (isEmpty) {
        onChange?.(null);
      } else {
        const dataUrl = canvas.toDataURL('image/png');
        onChange?.(dataUrl);
      }
    }
  }, [onChange]);

  return (
    <div className={cn('space-y-2', className)} ref={containerRef}>
      <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className={cn(
            'touch-none cursor-crosshair w-full',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          style={{ 
            height: `${height}px`,
            maxWidth: '100%',
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-muted-foreground/50 text-sm">
              Sign here
            </span>
          </div>
        )}
      </div>
      
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUndo}
          disabled={disabled || strokeHistory.current.length === 0}
          className="gap-1"
        >
          <Undo className="h-3 w-3" />
          Undo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={disabled || !hasSignature}
          className="gap-1"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </Button>
      </div>
    </div>
  );
}
