"use client";

import React, { useEffect, useRef } from "react";
import { soundManager } from "./SoundManager";
import { gsap } from "gsap";
import { ArrowDown, ShieldCheck, Zap, Users, CheckCircle2, ChevronRight, Eye } from "lucide-react";

interface Section01OpeningProps {
  onExploreClick: () => void;
  onWorkflowClick: () => void;
}

export default function Section01Opening({
  onExploreClick,
  onWorkflowClick,
}: Section01OpeningProps) {
  const containerRef = useRef<HTMLElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const paraRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        badgeRef.current,
        { y: -20, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.8, delay: 0.15 }
      )
        .fromTo(
          headingRef.current,
          { y: 40, opacity: 0, filter: "blur(8px)" },
          { y: 0, opacity: 1, filter: "blur(0px)", duration: 1.1 },
          "-=0.5"
        )
        .fromTo(
          paraRef.current,
          { y: 25, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9 },
          "-=0.6"
        )
        .fromTo(
          ctaRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7 },
          "-=0.5"
        )
        .fromTo(
          statsRef.current ? statsRef.current.children : [],
          { y: 35, opacity: 0, scale: 0.96 },
          { y: 0, opacity: 1, scale: 1, duration: 0.8, stagger: 0.1 },
          "-=0.4"
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      id="experience"
      className="relative min-h-[94vh] flex flex-col justify-between pt-28 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pointer-events-none"
    >
      {/* Top Banner / Hero Title Area */}
      <div className="pt-4 sm:pt-10 max-w-2xl pointer-events-auto glass-panel p-6 sm:p-9 rounded-3xl border border-white/70 shadow-2xl bg-white/80 backdrop-blur-xl">
        <div
          ref={badgeRef}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 border border-amber-300 mb-6 text-xs font-mono font-bold text-amber-900 shadow-sm"
        >
          <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
          <span>SDTT REAL CLASSROOM VERIFICATION • LIGHT ARCHITECTURAL MODE</span>
        </div>

        <h1
          ref={headingRef}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.08] mb-6"
        >
          Every Seat. <br />
          <span className="bg-gradient-to-r from-amber-700 via-amber-600 to-orange-700 bg-clip-text text-transparent">
            Accounted For.
          </span>
        </h1>

        <p
          ref={paraRef}
          className="text-lg sm:text-xl text-slate-700 font-medium leading-relaxed max-w-2xl mb-8"
        >
          A smarter approach to attendance verification in large lecture halls.
          Replacing manual roll calls with authenticated sessions, separated identity, liveness, and classroom-context evidence, and auditable human review.
        </p>

        {/* Action CTAs */}
        <div ref={ctaRef} className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => {
              soundManager.playClick();
              onExploreClick();
            }}
            className="group relative px-7 py-4 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2.5 transition-all shadow-lg shadow-amber-600/35 cursor-pointer"
          >
            <span>Explore the System</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              onWorkflowClick();
            }}
            className="px-7 py-4 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 transition-colors flex items-center gap-2.5 cursor-pointer shadow-sm"
          >
            <span>View Attendance Workflow</span>
            <Eye className="w-4 h-4 text-amber-700" />
          </button>
        </div>
      </div>

      {/* Bottom Floating Stats & Scroll Indicator */}
      <div className="pt-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pointer-events-auto">
        {/* Core Pillars */}
        <div
          ref={statsRef}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 w-full md:w-auto"
        >
          <div className="glass-panel p-4 rounded-xl border border-slate-300/90 bg-white/95 hover:border-amber-500 transition-all hover:scale-[1.02] shadow-md">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-mono font-bold mb-1">
              <Users className="w-3.5 h-3.5 text-amber-600" />
              <span>COHORT SCALE</span>
            </div>
            <div className="text-xl font-bold text-slate-900">80 / 120 / 240</div>
            <div className="text-[11px] text-slate-700 font-semibold">Tested lecture hall tiers</div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-300/90 bg-white/95 hover:border-amber-500 transition-all hover:scale-[1.02] shadow-md">
            <div className="flex items-center gap-2 text-orange-800 text-xs font-mono font-bold mb-1">
              <Zap className="w-3.5 h-3.5 text-orange-600" />
              <span>SPEED TARGET</span>
            </div>
            <div className="text-xl font-bold text-slate-900">&lt; 15 Seconds</div>
            <div className="text-[11px] text-slate-700 font-semibold">Batch session capture</div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-300/90 bg-white/95 hover:border-amber-500 transition-all hover:scale-[1.02] shadow-md">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-mono font-bold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>VERIFICATION</span>
            </div>
            <div className="text-xl font-bold text-slate-900">Multi-Source</div>
            <div className="text-[11px] text-slate-700 font-semibold">Selfie + Dynamic Challenge</div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-300/90 bg-white/95 hover:border-amber-500 transition-all hover:scale-[1.02] shadow-md">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-mono font-bold mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
              <span>INTEGRITY</span>
            </div>
            <div className="text-xl font-bold text-slate-900">Human-in-Loop</div>
            <div className="text-[11px] text-slate-700 font-semibold">Dispute audit logging</div>
          </div>
        </div>

        {/* Scroll Indicator Cue */}
        <div className="hidden md:flex items-center gap-2.5 text-xs font-mono text-slate-800 bg-white/95 px-3.5 py-1.5 rounded-full border border-slate-300 shadow-sm animate-bounce">
          <ArrowDown className="w-4 h-4 text-amber-700" />
          <span className="font-bold">Scroll to explore physical lecture hall</span>
        </div>
      </div>
    </section>
  );
}
