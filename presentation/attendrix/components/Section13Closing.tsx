"use client";

import React from "react";
import { soundManager } from "./SoundManager";
import { useSmoothScroll } from "./SmoothScrollProvider";
import { Sparkles, ArrowUp, ChevronRight, ShieldCheck } from "lucide-react";

interface Section13ClosingProps {
  onWorkflowClick: () => void;
  onArchitectureClick: () => void;
  onDashboardClick: () => void;
}

export default function Section13Closing({
  onWorkflowClick,
  onArchitectureClick,
  onDashboardClick,
}: Section13ClosingProps) {
  const { scrollTo } = useSmoothScroll();

  const scrollToTop = () => {
    soundManager.playClick();
    scrollTo(0, { duration: 1.8 });
  };

  return (
    <footer className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200">
      {/* Visual Closing Hero */}
      <div className="text-center max-w-4xl mx-auto mb-16">
        {/* Brand Emblem */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 mb-6 shadow-[0_4px_20px_rgba(217,119,6,0.3)]">
          <span className="font-mono font-black text-white text-2xl tracking-tighter">AX</span>
        </div>

        <h2 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
          Attendance, <br />
          <span className="bg-gradient-to-r from-amber-800 via-amber-700 to-orange-700 bg-clip-text text-transparent">
            With Evidence.
          </span>
        </h2>

        <p className="text-lg sm:text-xl text-slate-700 font-medium leading-relaxed max-w-2xl mx-auto mb-10">
          Designed to streamline attendance workflows, support evidence-based verification, and keep human judgment in the loop when the evidence is uncertain.
        </p>

        {/* 3 Main Action CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <button
            onClick={() => {
              soundManager.playClick();
              onWorkflowClick();
            }}
            className="px-6 py-3.5 rounded-xl text-sm font-semibold glass-panel bg-white/90 text-slate-700 hover:text-amber-700 hover:border-amber-400 border border-slate-200 shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Explore the Workflow</span>
            <ChevronRight className="w-4 h-4 text-amber-600" />
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              onArchitectureClick();
            }}
            className="px-6 py-3.5 rounded-xl text-sm font-semibold glass-panel bg-white/90 text-slate-700 hover:text-amber-700 hover:border-amber-400 border border-slate-200 shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>View Architecture</span>
            <ChevronRight className="w-4 h-4 text-amber-600" />
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              onDashboardClick();
            }}
            className="px-6 py-3.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2 transition-all shadow-[0_4px_16px_rgba(217,119,6,0.35)] cursor-pointer"
          >
            <span>Open Demo Dashboard</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Back to Top */}
        <button
          onClick={scrollToTop}
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-800 hover:text-amber-800 transition-colors cursor-pointer font-bold"
        >
          <ArrowUp className="w-3.5 h-3.5 text-amber-700" />
          <span>Back to entrance of lecture hall</span>
        </button>
      </div>

      {/* Academic Attribution & Ethical Compliance Footer */}
      <div className="pt-12 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 text-xs font-mono text-slate-700 font-semibold">
        <div>
          <span className="text-slate-900 font-bold block mb-1">
            ATTENDRIX • SDTT Classroom Attendance System
          </span>
          <p className="max-w-md text-slate-800 font-sans text-xs font-medium leading-relaxed">
            Academic engineering prototype exploring multi-factor attendance verification across 80, 120, and 240-seat university lecture halls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Ethical Biometric Safeguards</span>
          </div>

          <div className="text-slate-300">|</div>

          <div className="text-slate-600">
            FastAPI • React/Vite • Flutter • OpenCV • PostgreSQL
          </div>
        </div>
      </div>
    </footer>
  );
}
