"use client";

import { useEffect, useRef, type CSSProperties } from "react";

interface HeroRevealBackgroundProps {
  baseImageSrc: string;
  revealImageSrc: string;
  className?: string;
  size?: number;
  disabledOnMobile?: boolean;
  revealScale?: number;
  revealOffsetX?: string;
  revealOffsetY?: string;
}

/** Two perfectly stacked canvases; only the reveal image content receives alignment correction. */
export default function HeroRevealBackground({
  baseImageSrc,
  revealImageSrc,
  className = "",
  size = 460,
  disabledOnMobile = true,
  revealScale = 1,
  revealOffsetX = "0%",
  revealOffsetY = "0%",
}: HeroRevealBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const hero = root?.parentElement;
    if (!root || !hero) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (reducedMotion || (disabledOnMobile && coarsePointer)) return;

    let frame = 0;
    let currentX = hero.clientWidth * 0.5;
    let currentY = hero.clientHeight * 0.62;
    let targetX = currentX;
    let targetY = currentY;

    const render = () => {
      currentX += (targetX - currentX) * 0.13;
      currentY += (targetY - currentY) * 0.13;
      root.style.setProperty("--reveal-x", `${currentX}px`);
      root.style.setProperty("--reveal-y", `${currentY}px`);
      if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) frame = requestAnimationFrame(render);
      else frame = 0;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
    const move = (event: PointerEvent) => {
      const bounds = hero.getBoundingClientRect();
      targetX = event.clientX - bounds.left;
      targetY = event.clientY - bounds.top;
      // The pointer may already be inside while hydration finishes; movement must also activate reveal.
      root.dataset.active = "true";
      schedule();
    };
    const enter = (event: PointerEvent) => { root.dataset.active = "true"; move(event); };
    const leave = () => { root.dataset.active = "false"; };
    hero.addEventListener("pointerenter", enter);
    hero.addEventListener("pointermove", move);
    hero.addEventListener("pointerleave", leave);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      hero.removeEventListener("pointerenter", enter);
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", leave);
    };
  }, [disabledOnMobile]);

  const style = {
    "--reveal-size": `${size}px`,
    "--reveal-inner": `${Math.round(size * 0.34)}px`,
    "--reveal-outer": `${Math.round(size * 0.5)}px`,
    "--reveal-scale": revealScale,
    "--reveal-offset-x": revealOffsetX,
    "--reveal-offset-y": revealOffsetY,
  } as CSSProperties;

  return <div ref={rootRef} style={{ ...style, pointerEvents: "none" }} data-active="false" aria-hidden="true" className={`hero-reveal-background pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}>
    <div className="hero-reveal-canvas">
      <img src={baseImageSrc} alt="" draggable={false} className="hero-reveal-image hero-reveal-base" />
    </div>
    <div className="hero-reveal-canvas hero-reveal-mask">
      <img src={revealImageSrc} alt="" draggable={false} className="hero-reveal-image hero-reveal-magic" />
    </div>
  </div>;
}
