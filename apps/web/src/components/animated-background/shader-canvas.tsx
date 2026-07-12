"use client";

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

varying vec2 vUv;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uMouse;
uniform float uPixelRatio;
uniform float uTheme; // 0.0 = dark, 1.0 = light

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * aspect;

  float t = uTime * 0.045;

  p += uMouse * 0.08;

  // domain warping
  vec2 q = vec2(
    fbm(p * 1.4 + vec2(0.0, t)),
    fbm(p * 1.4 + vec2(5.2, 1.3) - t)
  );

  vec2 r = vec2(
    fbm(p * 1.4 + 1.8 * q + vec2(8.3, 2.8) + t * 1.15),
    fbm(p * 1.4 + 1.8 * q + vec2(1.2, 6.5) - t * 0.85)
  );

  float f = fbm(p * 1.4 + 2.2 * r) * 0.5 + 0.5;
  float e = clamp(length(r) * 0.9, 0.0, 1.0);
  float warm = clamp(dot(q, q) * 0.9, 0.0, 1.0);

  // dark palette — deeper base
  vec3 dBase  = vec3(0.014, 0.018, 0.035);
  vec3 dSteel = vec3(0.0, 0.83, 0.67);  // teal #00d4aa
  vec3 dTeal  = vec3(0.0, 0.72, 1.0);   // blue #00b8ff
  vec3 dAmber = vec3(0.78, 0.47, 0.18);

  // light palette — white base + blue clouds (mirrors dark's teal→blue)
  vec3 lBase  = vec3(0.95, 0.97, 1.0);   // clean white with faint blue
  vec3 lSteel = vec3(0.28, 0.52, 0.85);  // medium blue (like dark's teal role)
  vec3 lTeal  = vec3(0.18, 0.42, 0.78);  // deeper blue (like dark's blue role)
  vec3 lAmber = vec3(0.35, 0.55, 0.88);  // blue-shifted accent

  vec3 base  = mix(dBase, lBase, uTheme);
  vec3 steel = mix(dSteel, lSteel, uTheme);
  vec3 teal  = mix(dTeal, lTeal, uTheme);
  vec3 amber = mix(dAmber, lAmber, uTheme);

  vec3 col = base;
  float colorStrength = mix(1.0, 1.2, uTheme); // light theme needs stronger color to show clouds
  col = mix(col, steel, smoothstep(0.3, 0.9, f) * 0.45 * colorStrength);
  col = mix(col, teal,  smoothstep(0.2, 0.85, e) * 0.4 * colorStrength);
  col = mix(col, amber, smoothstep(0.4, 0.9, warm) * 0.3 * colorStrength);

  // volumetric light
  vec2 lightPos = vec2(-0.45, 0.42) * aspect + uMouse * 0.15;
  float ld = length(p - lightPos);
  float glowStrength = mix(0.9, 0.7, uTheme);
  float glow = exp(-ld * 0.75) * (0.55 + 0.6 * f);
  col += steel * glow * glowStrength * 0.5;

  vec2 lightPos2 = vec2(0.6, -0.4) * aspect + uMouse * 0.1;
  float ld2 = length(p - lightPos2);
  col += teal * exp(-ld2 * 0.95) * (0.35 + 0.4 * e) * 0.35 * glowStrength;

  // light rays
  float ang = atan(p.y - lightPos.y, p.x - lightPos.x);
  float rays = sin(ang * 9.0 + t * 2.0 + fbm(p * 2.0 + t) * 4.0);
  rays = smoothstep(0.55, 1.0, rays);
  col += steel * rays * exp(-ld * 0.9) * 0.18 * glowStrength;

  // keep center quiet — light theme shows clouds everywhere
  float d = length((uv - 0.5) * vec2(aspect.x, 1.0));
  float edge = smoothstep(0.22, 0.95, d);
  float quietness = mix(0.35, 0.7, uTheme); // light: clouds visible across the whole page
  col = mix(base * mix(1.15, 1.0, uTheme), col, mix(quietness, 1.0, edge));

  // grain
  float g = noise(uv * uResolution / uPixelRatio * 0.55 + t * 40.0);
  col += g * mix(0.02, 0.01, uTheme);

  // vignette — darker on dark, very mild on light
  float vig = smoothstep(1.35, 0.4, d);
  col *= mix(mix(0.55, 0.92, uTheme), 1.0, vig);

  // tone mapping
  col = col / (col + vec3(mix(0.55, 0.8, uTheme)));
  col *= mix(1.25, 1.1, uTheme);
  col = pow(col, vec3(mix(0.85, 0.95, uTheme)));

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

interface ShaderCanvasProps {
  mouse: React.RefObject<{ x: number; y: number }>;
  isDark: boolean;
}

export function ShaderCanvas({ mouse, isDark }: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const themeRef = useRef(isDark ? 0 : 1);
  themeRef.current = isDark ? 0 : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uMouse = gl.getUniformLocation(program, "uMouse");
    const uPixelRatio = gl.getUniformLocation(program, "uPixelRatio");
    const uTheme = gl.getUniformLocation(program, "uTheme");

    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    let mx = 0;
    let my = 0;

    const render = (now: number) => {
      const elapsed = prefersReduced ? 8 : (now - start) / 1000;
      const target = mouse.current ?? { x: 0, y: 0 };
      mx += (target.x - mx) * 0.05;
      my += (target.y - my) * 0.05;

      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uMouse, mx, my);
      gl.uniform1f(uPixelRatio, dpr);
      gl.uniform1f(uTheme, themeRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buffer);
    };
  }, [mouse]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
