import { useCallback, useEffect, useRef, useState } from 'react';
import { renderAction, renderBoard, normalizePoint, resizeCanvasToDisplaySize } from '../utils/canvas.js';

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function CanvasBoard({ actions, tool, color, size, onAction, onStrokePoint, onText }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(null);
  const [preview, setPreview] = useState(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    resizeCanvasToDisplaySize(canvas);
    renderBoard(canvas, actions);
    if (preview) {
      const ctx = canvas.getContext('2d');
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.save();
      ctx.scale(canvas.width / width, canvas.height / height);
      renderAction(ctx, preview, width, height);
      ctx.restore();
    }
  }, [actions, preview]);

  useEffect(() => {
    redraw();
    const observer = new ResizeObserver(redraw);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [redraw]);

  const pointFromEvent = (event) => normalizePoint(
    event.clientX,
    event.clientY,
    canvasRef.current.getBoundingClientRect(),
  );

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    const point = pointFromEvent(event);
    canvasRef.current.setPointerCapture?.(event.pointerId);

    if (tool === 'text') {
      const text = window.prompt('Enter your note:');
      if (text?.trim()) {
        onText({ id: uid(), type: 'text', x: point.x, y: point.y, text: text.trim(), color, fontSize: Math.max(18, size * 3) });
      }
      return;
    }

    if (tool === 'pen') {
      const stroke = { id: uid(), type: 'stroke', points: [point], color, size };
      drawingRef.current = { kind: 'stroke', strokeId: stroke.id, start: point, action: stroke };
      onAction(stroke);
      return;
    }

    drawingRef.current = { kind: tool, start: point };
    setPreview({ id: 'preview', type: tool, start: point, end: point, color, size });
  };

  const handlePointerMove = (event) => {
    const drawing = drawingRef.current;
    if (!drawing) return;
    const point = pointFromEvent(event);

    if (drawing.kind === 'stroke') {
      onStrokePoint(drawing.strokeId, point);
      return;
    }

    setPreview({ id: 'preview', type: drawing.kind, start: drawing.start, end: point, color, size });
  };

  const handlePointerUp = (event) => {
    const drawing = drawingRef.current;
    if (!drawing) return;
    const point = pointFromEvent(event);
    if (drawing.kind !== 'stroke') {
      onAction({ id: uid(), type: drawing.kind, start: drawing.start, end: point, color, size });
    }
    drawingRef.current = null;
    setPreview(null);
  };

  const handlePointerCancel = () => {
    drawingRef.current = null;
    setPreview(null);
  };

  return (
    <section className="canvas-panel">
      <div className="canvas-tip">
        <span>⌘</span>
        <span>{tool === 'pen' ? 'Draw freely' : tool === 'text' ? 'Click anywhere to add a note' : `Drag to draw a ${tool}`}</span>
      </div>
      <canvas
        ref={canvasRef}
        className="board-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={(event) => {
          if (drawingRef.current && tool === 'pen') handlePointerMove(event);
        }}
      />
    </section>
  );
}
