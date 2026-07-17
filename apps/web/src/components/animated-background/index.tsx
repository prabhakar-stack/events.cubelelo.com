"use client";

import { useEffect, useState } from "react";
import { StaticBackground } from "./static-background";

export function AnimatedBackground() {
  const [isDark, setIsDark] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const check = () => {
      const cl = document.body.classList;
      setHidden(cl.contains("competition-mode") || cl.contains("no-bg"));
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  if (hidden) return null;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <StaticBackground isDark={isDark} />

      {/* soft radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(120% 90% at 12% 8%, rgba(0,212,170,0.12), transparent 46%)," +
              "radial-gradient(120% 90% at 92% 96%, rgba(0,184,255,0.1), transparent 48%)"
            : "radial-gradient(120% 90% at 12% 8%, rgba(40,100,220,0.1), transparent 46%)," +
              "radial-gradient(120% 90% at 92% 96%, rgba(30,80,200,0.09), transparent 48%)",
        }}
      />

      {/* vignette mask */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(70% 70% at 50% 50%, transparent 55%, rgba(3,4,9,0.6) 100%)"
            : "radial-gradient(70% 70% at 50% 50%, transparent 55%, rgba(200,210,230,0.35) 100%)",
        }}
      />

      {/* grain */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{
          opacity: isDark ? 0.04 : 0.02,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
