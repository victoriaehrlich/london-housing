// src/hooks/useContainerSize.js
import * as React from "react";

export function useContainerSize(ref, fallback = 820) {
  const [w, setW] = React.useState(fallback);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setW(el.clientWidth || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fallback]);
  return w;
}
