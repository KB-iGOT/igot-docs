import { useLayoutEffect, useRef, useState } from 'react';

/** Scale factor that fits a fixed-size canvas (width x height) into its container's
 *  width and the visible height left below `reservedTop` px, never above 1. */
export function useFitScale<T extends HTMLElement>(width: number, height: number, reservedTop = 0) {
  const ref = useRef<T>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const byWidth = el.clientWidth / width;
      const byHeight = (window.innerHeight - reservedTop) / height;
      setScale(Math.max(0.3, Math.min(1, byWidth, byHeight)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, [width, height, reservedTop]);

  return { ref, scale };
}
