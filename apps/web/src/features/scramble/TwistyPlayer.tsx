"use client";

import { useEffect, useRef } from "react";

interface TwistyPlayerProps {
  /** cubing.js puzzle id, e.g. "3x3x3", "2x2x2", "pyraminx". */
  puzzle: string;
  /** The scramble to display as the cube's static state. */
  scramble: string;
  className?: string;
  /** "2D" (flat net, default — used for competition/practice scramble views) or "3D" (rendered cube, used decoratively). */
  visualization?: "2D" | "3D";
}

/**
 * Renders a 2D cube net for a scramble using cubing.js's <twisty-player> web
 * component. The component is browser-only (custom element + WASM), so it is
 * imported lazily inside an effect and created imperatively to avoid SSR issues
 * and custom-element JSX typing.
 */
export function TwistyPlayer({ puzzle, scramble, className, visualization = "2D" }: TwistyPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await import("cubing/twisty");
      if (cancelled || !hostRef.current) return;

      if (!playerRef.current) {
        const el = document.createElement("twisty-player");
        el.setAttribute("visualization", visualization);
        el.setAttribute("background", "none");
        el.setAttribute("control-panel", "none");
        el.setAttribute("hint-facelets", "none");
        el.style.width = "100%";
        el.style.height = "100%";
        hostRef.current.appendChild(el);
        playerRef.current = el;
      }

      const el = playerRef.current;
      el.puzzle = puzzle;
      // Show the scrambled state statically (no animation/playback).
      el.experimentalSetupAlg = scramble;
      el.alg = "";
    })();

    return () => {
      cancelled = true;
    };
  }, [puzzle, scramble, visualization]);

  return <div ref={hostRef} className={className} />;
}
