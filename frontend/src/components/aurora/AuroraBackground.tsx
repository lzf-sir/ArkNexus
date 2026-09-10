import { useEffect, useRef } from "react";

interface Orb {
  color: string;
  size: number;
  startX: string;
  startY: string;
  driftX: number;
  driftY: number;
  duration: number;
  opacity: number;
}

const ORBS: Orb[] = [
  { color: "rgba(0,150,255,0.5)", size: 600, startX: "-10%", startY: "-10%", driftX: 80, driftY: 60, duration: 14, opacity: 0.22 },
  { color: "rgba(150,80,255,0.5)", size: 700, startX: "70%", startY: "20%", driftX: -100, driftY: 80, duration: 16, opacity: 0.18 },
  { color: "rgba(255,100,200,0.5)", size: 650, startX: "20%", startY: "70%", driftX: 120, driftY: -60, duration: 15, opacity: 0.18 },
  { color: "rgba(0,230,168,0.5)", size: 550, startX: "50%", startY: "50%", driftX: -60, driftY: -100, duration: 18, opacity: 0.12 },
];

function OrbEl({ orb }: { orb: Orb }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: `translate(${orb.driftX}px, ${orb.driftY}px)` },
        { transform: "translate(0, 0)" },
      ],
      { duration: orb.duration * 1000, iterations: Infinity, easing: "ease-in-out" }
    );
  }, [orb.driftX, orb.driftY, orb.duration]);

  return (
    <div
      ref={ref}
      data-aurora-orb
      aria-hidden
      style={{
        position: "absolute",
        left: orb.startX,
        top: orb.startY,
        width: orb.size,
        height: orb.size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
        filter: `blur(80px)`,
        opacity: orb.opacity,
        willChange: "transform",
        pointerEvents: "none",
      }}
    />
  );
}

export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0"
      style={{
        zIndex: -1,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {ORBS.map((orb, i) => (
        <OrbEl key={i} orb={orb} />
      ))}
    </div>
  );
}
