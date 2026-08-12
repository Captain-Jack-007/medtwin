"use client";

// Hologram shader material for the Digital Twin body shell.
// Produces a Fresnel rim-glow, a travelling horizontal scan band, and faint
// horizontal grid lines — the "medical hologram" look. GENERIC anatomy only.
import * as THREE from "three";

export function makeHologramMaterial(colorHex: string): THREE.ShaderMaterial {
  const color = new THREE.Color(colorHex);
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uOpacity: { value: 0.55 },
      uScanY: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = viewMatrix * wp;
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uScanY;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        // Fresnel rim: bright at grazing angles, faint head-on.
        float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 2.2);
        // Faint horizontal contour lines climbing over time.
        float grid = smoothstep(0.90, 1.0, abs(sin((vWorld.y * 34.0) - uTime * 1.2)));
        // Travelling scan band.
        float band = smoothstep(0.14, 0.0, abs(vWorld.y - uScanY));
        float glow = fres * 0.9 + grid * 0.25 + band * 0.8;
        float a = clamp(uOpacity * (0.35 + fres) + band * 0.5, 0.0, 1.0);
        vec3 col = uColor * (0.6 + glow * 1.6);
        gl_FragColor = vec4(col, a);
      }
    `,
  });
}

// Realistic organ material (spec §10–§13). The organ keeps a REALISTIC base
// color (deep red heart, rose lungs, warm-gray brain); risk is layered as an
// emissive ACCENT whose strength is driven by uRisk (0 = calm/LOW). A separate
// cyan selection rim (uSelect) expresses USER SELECTION independently of risk,
// so interaction state never masquerades as medical color.
export function makeOrganMaterial(baseHex: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: new THREE.Color(baseHex) }, // realistic anatomical color
      uAccent: { value: new THREE.Color("#39d98a") }, // risk accent color
      uRisk: { value: 0 }, // 0..1 emissive strength from triage state
      uSelect: { value: 0 }, // 0..1 cyan selection outline strength
      uPulse: { value: 1 }, // subtle beat/breath scale hook
    },
    vertexShader: /* glsl */ `
      uniform float uPulse;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position * uPulse;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform vec3 uBase;
      uniform vec3 uAccent;
      uniform float uRisk;
      uniform float uSelect;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float ndv = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 1.8);
        // Realistic shaded base: soft diffuse falloff, gentle sheen.
        vec3 base = uBase * (0.55 + 0.45 * ndv);
        // Risk overlay: emissive tint toward accent, pulses only when elevated.
        float pulse = 0.5 + 0.5 * sin(uTime * 2.2);
        float riskGlow = uRisk * (0.6 + 0.4 * pulse);
        vec3 col = mix(base, uAccent, clamp(uRisk * 0.5, 0.0, 0.55));
        col += uAccent * fres * riskGlow * 1.2;
        // Cyan selection rim — independent of risk.
        vec3 selCol = vec3(0.36, 0.85, 1.0);
        col += selCol * fres * uSelect * 1.4;
        float a = clamp(0.85 + fres * 0.15, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
      }
    `,
  });
}

// Resolve a CSS var (e.g. "var(--red)") or hex to a concrete hex/color string.
export function resolveColor(c: string): string {
  if (typeof window === "undefined" || !c.startsWith("var(")) return c || "#5ec8ff";
  const name = c.slice(4, -1).trim();
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || "#5ec8ff";
}
