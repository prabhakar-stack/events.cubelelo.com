"use client";

import { TwistyPlayer } from "@/features/scramble/TwistyPlayer";

/**
 * A real, draggable 3D cube (via cubing/twisty) used purely decoratively —
 * the app already ships this renderer for scrambles/practice, it was just
 * never used as a hero/marketing moment. Users can grab and spin it.
 */
export function DecorativeCube({ scramble, className = "" }: { scramble: string; className?: string }) {
  return (
    <div className={`cube-ambient-float ${className}`}>
      <TwistyPlayer puzzle="3x3x3" scramble={scramble} visualization="3D" className="h-full w-full" />
    </div>
  );
}
