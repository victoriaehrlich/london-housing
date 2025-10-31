// src/hooks/useContainerSize.js
import * as React from "react";

export function useContainerSize(ref, fallback = 820) {
  const [w, setW] = React.useState(fallback);

  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    let frame;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setW(el.clientWidth || fallback);
      });
    });

    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [ref, fallback]);

  return w;
}
