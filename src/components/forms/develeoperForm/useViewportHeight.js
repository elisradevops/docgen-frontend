import { useEffect, useState } from 'react';

// The viewport height mapped through `compute` (for example the height of a scrolling area), updated at most
// once per animation frame while the window is being resized, so a drag does not re-render a large table
// on every resize event.
export const useViewportHeight = (compute) => {
  const [height, setHeight] = useState(() => compute(window.innerHeight));
  useEffect(() => {
    let frame = null;
    const onResize = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setHeight(compute(window.innerHeight));
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [compute]);
  return height;
};
