import { useLayoutEffect, useRef } from 'react';
import { PixelBuffer } from './pixels';
import styles from './Scene.module.css';

interface PixelCanvasProps {
  /** Size in art pixels; the canvas is shown `px` times larger. */
  readonly width: number;
  readonly height: number;
  /** CSS px per art pixel. */
  readonly px: number;
  /** Must be stable (useCallback): the scene is repainted whenever it changes. */
  readonly paint: (buf: PixelBuffer) => void;
}

/** Paints a scene once at art resolution and lets the browser upscale it with hard edges. */
export function PixelCanvas({ width, height, px, paint }: PixelCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx === null || ctx === undefined || width < 1 || height < 1) return;
    const buf = new PixelBuffer(width, height);
    paint(buf);
    ctx.putImageData(new ImageData(buf.data, width, height), 0, 0);
  }, [width, height, paint]);

  return (
    <canvas
      ref={ref}
      className={styles.canvas}
      width={Math.max(1, width)}
      height={Math.max(1, height)}
      style={{ width: width * px, height: height * px }}
    />
  );
}

/** Art pixels needed to cover `css` CSS pixels at `px` CSS px per art pixel. */
export function artSize(css: number, px: number): number {
  return Math.max(1, Math.ceil(css / px));
}
