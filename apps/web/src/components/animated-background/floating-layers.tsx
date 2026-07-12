"use client";

import { motion, type MotionValue, useTransform } from "motion/react";

type Props = {
  px: MotionValue<number>;
  py: MotionValue<number>;
  isDark: boolean;
};

function useParallax(mv: MotionValue<number>, depth: number) {
  return useTransform(mv, [-1, 1], [-depth, depth]);
}

export function FloatingLayers({ px, py, isDark }: Props) {
  const x1 = useParallax(px, 14);
  const y1 = useParallax(py, 10);
  const x2 = useParallax(px, 30);
  const y2 = useParallax(py, 22);
  const x3 = useParallax(px, 52);
  const y3 = useParallax(py, 40);
  const x4 = useParallax(px, -26);
  const y4 = useParallax(py, -18);

  const stroke = isDark ? "rgba(0,212,170,0.5)" : "rgba(40,90,200,0.4)";
  const strokeFaint = isDark ? "rgba(0,184,255,0.35)" : "rgba(30,70,180,0.35)";
  const planeBorder = isDark ? "border-white/[0.12]" : "border-blue-600/15";
  const planeGradient = isDark
    ? "from-sky-300/[0.08] to-transparent"
    : "from-blue-500/[0.1] to-transparent";
  const planeGradient2 = isDark
    ? "from-teal-300/[0.07] to-transparent"
    : "from-blue-600/[0.09] to-transparent";

  return (
    <div className="absolute inset-0 overflow-hidden [perspective:1400px]" aria-hidden="true">
      {/* FAR: large soft plane, upper-left */}
      <motion.div
        style={{ x: x1, y: y1 }}
        className="absolute -left-[6%] top-[8%] h-[42vmin] w-[42vmin]"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0.3, 0.5, 0.3],
            rotate: [0, 6, 0],
            y: [0, -18, 0],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className={`h-full w-full rounded-[2rem] border ${planeBorder} bg-gradient-to-br ${planeGradient} backdrop-blur-[1px] [transform:rotateX(52deg)_rotateZ(28deg)]`}
        />
      </motion.div>

      {/* FAR: plane, lower-right */}
      <motion.div
        style={{ x: x1, y: y1 }}
        className="absolute -right-[4%] bottom-[6%] h-[46vmin] w-[46vmin]"
      >
        <motion.div
          animate={{
            opacity: [0.25, 0.4, 0.25],
            rotate: [0, -5, 0],
            y: [0, 20, 0],
          }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          className={`h-full w-full rounded-[2.5rem] border ${planeBorder} bg-gradient-to-tl ${planeGradient2} [transform:rotateX(-48deg)_rotateZ(-22deg)]`}
        />
      </motion.div>

      {/* MID: wireframe grid panel, left */}
      <motion.div
        style={{ x: x2, y: y2 }}
        className="absolute left-[3%] top-[26%] h-[34vmin] w-[34vmin]"
      >
        <motion.div
          animate={{ rotate: [0, 8, 0], y: [0, -14, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="h-full w-full [transform:rotateX(58deg)_rotateZ(34deg)]"
        >
          <WireGrid stroke={stroke} />
        </motion.div>
      </motion.div>

      {/* MID: wireframe ring, right */}
      <motion.div
        style={{ x: x3, y: y3 }}
        className="absolute right-[6%] top-[16%] h-[26vmin] w-[26vmin]"
      >
        <motion.div
          animate={{ rotate: [0, -360] }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
          className="h-full w-full [transform:rotateX(64deg)]"
        >
          <WireRing stroke={strokeFaint} />
        </motion.div>
      </motion.div>

      {/* NEAR: crisp thin plane, lower-left */}
      <motion.div
        style={{ x: x3, y: y3 }}
        className="absolute left-[8%] bottom-[10%] h-[22vmin] w-[22vmin]"
      >
        <motion.div
          animate={{ opacity: [0.4, 0.6, 0.4], rotate: [0, -7, 0], y: [0, 16, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className={`h-full w-full rounded-2xl border ${planeBorder} ${isDark ? "bg-white/[0.04]" : "bg-blue-600/[0.06]"} backdrop-blur-[2px] [transform:rotateX(-54deg)_rotateZ(18deg)]`}
        />
      </motion.div>

      {/* NEAR: wireframe polygon, bottom-right */}
      <motion.div
        style={{ x: x4, y: y4 }}
        className="absolute right-[14%] bottom-[16%] h-[16vmin] w-[16vmin]"
      >
        <motion.div
          animate={{ rotate: [0, 12, 0], y: [0, -12, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="h-full w-full [transform:rotateX(46deg)_rotateZ(-26deg)]"
        >
          <WirePoly stroke={stroke} />
        </motion.div>
      </motion.div>

      {/* scanline */}
      <motion.div
        animate={{ x: ["-30%", "130%"] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className={`absolute top-[12%] h-px w-[40%] bg-gradient-to-r from-transparent ${isDark ? "via-sky-200/30" : "via-blue-400/30"} to-transparent`}
      />
    </div>
  );
}

function WireGrid({ stroke }: { stroke: string }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
      <g fill="none" stroke={stroke} strokeWidth="0.4">
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 12.5} x2="100" y2={i * 12.5} />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 12.5} y1="0" x2={i * 12.5} y2="100" />
        ))}
      </g>
    </svg>
  );
}

function WireRing({ stroke }: { stroke: string }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
      <g fill="none" stroke={stroke} strokeWidth="0.5">
        <circle cx="50" cy="50" r="48" />
        <circle cx="50" cy="50" r="34" strokeOpacity="0.6" />
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={+(50 + Math.cos(a) * 34).toFixed(3)}
              y1={+(50 + Math.sin(a) * 34).toFixed(3)}
              x2={+(50 + Math.cos(a) * 48).toFixed(3)}
              y2={+(50 + Math.sin(a) * 48).toFixed(3)}
            />
          );
        })}
      </g>
    </svg>
  );
}

function WirePoly({ stroke }: { stroke: string }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
      <g fill="none" stroke={stroke} strokeWidth="0.6">
        <polygon points="50,4 92,28 92,72 50,96 8,72 8,28" />
        <polygon points="50,22 76,37 76,63 50,78 24,63 24,37" strokeOpacity="0.5" />
        <line x1="50" y1="4" x2="50" y2="96" strokeOpacity="0.3" />
        <line x1="8" y1="28" x2="92" y2="72" strokeOpacity="0.3" />
        <line x1="92" y1="28" x2="8" y2="72" strokeOpacity="0.3" />
      </g>
    </svg>
  );
}
