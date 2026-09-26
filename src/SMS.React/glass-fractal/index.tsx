"use client";

import { useEffect, useRef, useState } from "react";
import { createRenderer } from "./renderer";

export type Shape = "fractal" | "orb";

interface ExampleProps {
  readonly shape?: Shape;
  readonly onShapeChange?: (shape: Shape) => void;
  readonly showControls?: boolean;
}

const SHAPES = [
  { id: "fractal", label: "Fractal", sphereMix: 0 },
  { id: "orb", label: "Orb", sphereMix: 1 },
] as const satisfies readonly {
  id: Shape;
  label: string;
  sphereMix: number;
}[];

export function Example({
  shape: controlledShape,
  onShapeChange,
  showControls = true,
}: ExampleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createRenderer>>(null);
  const [uncontrolledShape, setUncontrolledShape] = useState<Shape>("fractal");
  const shape = controlledShape ?? uncontrolledShape;
  const [isReady, setIsReady] = useState(false);
  const [renderUnavailable, setRenderUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createRenderer({ canvas, showDebugGui: false });
    rendererRef.current = renderer;
    void renderer.ready.then(
      () => {
        if (!cancelled) setIsReady(true);
      },
      () => {
        if (!cancelled) setRenderUnavailable(true);
      }
    );
    return () => {
      cancelled = true;
      if (rendererRef.current === renderer) rendererRef.current = null;
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setSphereMix(shape === "orb" ? 1 : 0);
  }, [shape]);

  const selectShape = (nextShape: Shape, sphereMix: number) => {
    if (controlledShape === undefined) setUncontrolledShape(nextShape);
    onShapeChange?.(nextShape);
    rendererRef.current?.setSphereMix(sphereMix);
  };

  return (
    <div className="glass-fractal-root">
      <canvas
        ref={canvasRef}
        className={`glass-fractal-canvas ${
          isReady ? "opacity-100" : "opacity-0"
        }`}
      />

      {renderUnavailable && (
        <div className="glass-fractal-unavailable" role="status">
          <span className="glass-fractal-fallback-shape" />
          <small>APERÇU INTERACTIF INDISPONIBLE SUR CET APPAREIL</small>
        </div>
      )}

      {showControls && (
        <div
          role="group"
          aria-label="Fractal shape"
          className="glass-fractal-controls"
        >
          {SHAPES.map((option) => {
            const selected = shape === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => selectShape(option.id, option.sphereMix)}
                className={`glass-fractal-control ${selected ? "is-selected" : ""}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Example;
