"use client";

import { useState, useEffect, useRef } from "react";

/* ── Pupil ── */
interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
}

const Pupil = ({ size = 12, maxDistance = 5, pupilColor = "#042F2E", forceLookX, forceLookY }: PupilProps) => {
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const pupilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const pos = (() => {
    if (!pupilRef.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    const r = pupilRef.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 2);
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const a = Math.atan2(dy, dx);
    return { x: Math.cos(a) * dist, y: Math.sin(a) * dist };
  })();

  return (
    <div ref={pupilRef} className="rounded-full"
      style={{ width: size, height: size, backgroundColor: pupilColor, transform: `translate(${pos.x}px, ${pos.y}px)`, transition: "transform 0.1s ease-out" }} />
  );
};

/* ── EyeBall ── */
interface EyeBallProps {
  size?: number; pupilSize?: number; maxDistance?: number;
  eyeColor?: string; pupilColor?: string; isBlinking?: boolean;
  forceLookX?: number; forceLookY?: number;
}

const EyeBall = ({ size = 48, pupilSize = 16, maxDistance = 10, eyeColor = "white", pupilColor = "#042F2E", isBlinking = false, forceLookX, forceLookY }: EyeBallProps) => {
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const pos = (() => {
    if (!eyeRef.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    const r = eyeRef.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 2);
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const a = Math.atan2(dy, dx);
    return { x: Math.cos(a) * dist, y: Math.sin(a) * dist };
  })();

  return (
    <div ref={eyeRef} className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{ width: size, height: isBlinking ? 2 : size, backgroundColor: eyeColor, overflow: "hidden" }}>
      {!isBlinking && (
        <div className="rounded-full" style={{ width: pupilSize, height: pupilSize, backgroundColor: pupilColor, transform: `translate(${pos.x}px, ${pos.y}px)`, transition: "transform 0.1s ease-out" }} />
      )}
    </div>
  );
};

/* ── AnimatedLoginCharacters ── */
interface Props {
  isFocused?: boolean;
}

const AnimatedLoginCharacters: React.FC<Props> = ({ isFocused = false }) => {
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const [tealBlinking, setTealBlinking] = useState(false);
  const [darkBlinking, setDarkBlinking] = useState(false);
  const [lookingAtEachOther, setLookingAtEachOther] = useState(false);
  const tealRef = useRef<HTMLDivElement>(null);
  const darkRef = useRef<HTMLDivElement>(null);
  const violetRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  // blink — Teal
  useEffect(() => {
    const schedule = (): ReturnType<typeof setTimeout> => setTimeout(() => { setTealBlinking(true); setTimeout(() => { setTealBlinking(false); schedule(); }, 150); }, Math.random() * 4000 + 3000);
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  // blink — Dark Teal
  useEffect(() => {
    const schedule = (): ReturnType<typeof setTimeout> => setTimeout(() => { setDarkBlinking(true); setTimeout(() => { setDarkBlinking(false); schedule(); }, 150); }, Math.random() * 4000 + 3000);
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  // look at each other on focus
  useEffect(() => {
    if (isFocused) { setLookingAtEachOther(true); const t = setTimeout(() => setLookingAtEachOther(false), 800); return () => clearTimeout(t); }
    else setLookingAtEachOther(false);
  }, [isFocused]);

  const calc = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, skew: 0 };
    const r = ref.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 3);
    return { faceX: Math.max(-15, Math.min(15, dx / 20)), faceY: Math.max(-10, Math.min(10, dy / 30)), skew: Math.max(-6, Math.min(6, -dx / 120)) };
  };

  const tealP = calc(tealRef);
  const darkP = calc(darkRef);
  const violetP = calc(violetRef);
  const lightP = calc(lightRef);

  return (
    <div className="relative" style={{ width: 550, height: 400 }}>
      {/* Teal — Back */}
      <div ref={tealRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{ left: 70, width: 180, height: isFocused ? 440 : 400, backgroundColor: "#0D9488", borderRadius: "10px 10px 0 0", zIndex: 1, transform: isFocused ? `skewX(${(tealP.skew || 0) - 12}deg) translateX(40px)` : `skewX(${tealP.skew || 0}deg)`, transformOrigin: "bottom center" }}>
        <div className="absolute flex gap-8 transition-all duration-700 ease-in-out"
          style={{ left: lookingAtEachOther ? 55 : 45 + tealP.faceX, top: lookingAtEachOther ? 65 : 40 + tealP.faceY }}>
          <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#042F2E" isBlinking={tealBlinking} forceLookX={lookingAtEachOther ? 3 : undefined} forceLookY={lookingAtEachOther ? 4 : undefined} />
          <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#042F2E" isBlinking={tealBlinking} forceLookX={lookingAtEachOther ? 3 : undefined} forceLookY={lookingAtEachOther ? 4 : undefined} />
        </div>
      </div>

      {/* Dark Teal — Center */}
      <div ref={darkRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{ left: 240, width: 120, height: 310, backgroundColor: "#0F766E", borderRadius: "8px 8px 0 0", zIndex: 2, transform: lookingAtEachOther ? `skewX(${(darkP.skew || 0) * 1.5 + 10}deg) translateX(20px)` : isFocused ? `skewX(${(darkP.skew || 0) * 1.5}deg)` : `skewX(${darkP.skew || 0}deg)`, transformOrigin: "bottom center" }}>
        <div className="absolute flex gap-6 transition-all duration-700 ease-in-out"
          style={{ left: lookingAtEachOther ? 32 : 26 + darkP.faceX, top: lookingAtEachOther ? 12 : 32 + darkP.faceY }}>
          <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#042F2E" isBlinking={darkBlinking} forceLookX={lookingAtEachOther ? 0 : undefined} forceLookY={lookingAtEachOther ? -4 : undefined} />
          <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#042F2E" isBlinking={darkBlinking} forceLookX={lookingAtEachOther ? 0 : undefined} forceLookY={lookingAtEachOther ? -4 : undefined} />
        </div>
      </div>

      {/* Violet semi-circle — Front left */}
      <div ref={violetRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{ left: 0, width: 240, height: 200, backgroundColor: "#7C3AED", borderRadius: "120px 120px 0 0", zIndex: 3, transform: `skewX(${violetP.skew || 0}deg)`, transformOrigin: "bottom center" }}>
        <div className="absolute flex gap-8 transition-all duration-200 ease-out"
          style={{ left: 82 + (violetP.faceX || 0), top: 90 + (violetP.faceY || 0) }}>
          <Pupil size={12} maxDistance={5} pupilColor="#042F2E" />
          <Pupil size={12} maxDistance={5} pupilColor="#042F2E" />
        </div>
      </div>

      {/* Light Teal — Front right */}
      <div ref={lightRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{ left: 310, width: 140, height: 230, backgroundColor: "#14B8A6", borderRadius: "70px 70px 0 0", zIndex: 4, transform: `skewX(${lightP.skew || 0}deg)`, transformOrigin: "bottom center" }}>
        <div className="absolute flex gap-6 transition-all duration-200 ease-out"
          style={{ left: 52 + (lightP.faceX || 0), top: 40 + (lightP.faceY || 0) }}>
          <Pupil size={12} maxDistance={5} pupilColor="#042F2E" />
          <Pupil size={12} maxDistance={5} pupilColor="#042F2E" />
        </div>
        <div className="absolute w-20 h-[4px] bg-[#042F2E] rounded-full transition-all duration-200 ease-out"
          style={{ left: 40 + (lightP.faceX || 0), top: 88 + (lightP.faceY || 0) }} />
      </div>
    </div>
  );
};

export default AnimatedLoginCharacters;
