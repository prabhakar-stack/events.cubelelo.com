"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function PageProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    timers.current.forEach(clearTimeout);
    timers.current = [];

    setVisible(true);
    setWidth(30);
    timers.current.push(setTimeout(() => setWidth(75), 80));
    timers.current.push(
      setTimeout(() => {
        setWidth(100);
        timers.current.push(
          setTimeout(() => {
            setVisible(false);
            setWidth(0);
          }, 250),
        );
      }, 220),
    );

    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      className="fixed left-0 top-0 z-[100] h-0.5 bg-accent-primary transition-[width,opacity] duration-200 ease-out"
      style={{
        width: `${width}%`,
        opacity: visible ? 1 : 0,
        boxShadow: "0 0 8px var(--accent-glow), 0 0 4px var(--accent-primary)",
      }}
    />
  );
}
