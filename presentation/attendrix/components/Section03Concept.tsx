"use client";

import React, { useState } from "react";
import { soundManager } from "./SoundManager";
import { Monitor, Smartphone, ShieldCheck, Cpu, ArrowRight, UserCheck, Eye, Layers, Lock, Sparkles } from "lucide-react";

export default function Section03Concept() {
  const [activeTab, setActiveTab] = useState<number>(0);

  const pillars = [
    {
      title: "Teacher Session Control",
      icon: Monitor,
      color: "text-amber-700",
      borderColor: "border-amber-400",
      desc: "An authorized teacher opens the server-timed session, loads the assigned roster, and configures contextual evidence settings.",
      role: "Initiation & Authority",
    },
    {
      title: "Server-Timed Window",
      icon: Lock,
      color: "text-orange-700",
      borderColor: "border-orange-400",
      desc: "The API controls scheduled, open, closed, and finalized states. Client clocks cannot authorize a late upload.",
      role: "Session Authority",
    },
    {
      title: "Student 1:1 Selfie Verification",
      icon: Smartphone,
      color: "text-amber-700",
      borderColor: "border-amber-400",
      desc: "Student completes controller-authorized enrollment. A server-side face model compares the guided front-camera evidence with the encrypted enrolled representation.",
      role: "Biometric Identity Grounding",
    },
    {
      title: "Contextual Classroom Capture",
      icon: Eye,
      color: "text-amber-700",
      borderColor: "border-amber-400",
      desc: "A rear-camera classroom image provides contextual scene evidence. It cannot prove an exact seat or identify every person.",
      role: "Environmental Context",
    },
    {
      title: "Backend Integrity Engine",
      icon: Cpu,
      color: "text-orange-700",
      borderColor: "border-orange-400",
      desc: "FastAPI validates authorization, server time, image quality, duplicate submissions, separate evidence results, and audit state.",
      role: "Anti-Replay & Deduplication",
    },
    {
      title: "Human-in-the-Loop Review",
      icon: UserCheck,
      color: "text-amber-700",
      borderColor: "border-amber-400",
      desc: "Inconclusive evidence and unavailable model results enter a teacher queue. The system keeps a reviewable pending state.",
      role: "Ethical Fail-Safe",
    },
  ];

  return (
    <section id="concept" className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-mono text-xs font-bold mb-4 shadow-sm">
          <Layers className="w-3.5 h-3.5" />
          <span>SECTION 03 • SYSTEM CONCEPT</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          From Presence to <br />
          <span className="bg-gradient-to-r from-amber-800 via-amber-700 to-orange-700 bg-clip-text text-transparent">
            Verifiable Evidence.
          </span>
        </h2>
        <p className="text-base sm:text-lg text-slate-700 font-medium">
           Attendrix replaces fragile single-point assumptions with separate, reviewable evidence categories.
           Identity, liveness, and classroom context are evaluated independently by the backend.
        </p>
      </div>

      {/* Dual Streams Architecture */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl border border-slate-300/90 bg-white/95 mb-16 relative overflow-hidden shadow-xl">
        <div className="text-xs font-mono text-amber-900 font-bold mb-6 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>DUAL-STREAM EVIDENCE CONVERGENCE</span>
          </span>
              <span className="text-slate-700 hidden sm:inline font-bold">EVIDENCE CATEGORIES</span>
        </div>

        {/* Visual Dual Streams Flowing to Central Engine */}
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-6 items-center">
          {/* Stream 1: Faculty / Classroom Room Environment */}
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-300 shadow-md relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
                <Monitor className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">STREAM A: Classroom Context</h4>
                 <span className="text-[11px] text-amber-800 font-mono font-bold">Teacher session + classroom context</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-800 font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-700 font-bold">Session ID:</span>
                <span className="text-slate-900 font-bold">SES-8491 (CS-401)</span>
              </div>
              <div className="flex justify-between">
                 <span className="text-slate-700 font-bold">Session State:</span>
                 <span className="text-amber-800 font-bold">OPEN / SERVER CLOCK</span>
              </div>
              <div className="flex justify-between">
                 <span className="text-slate-700 font-bold">Context Evidence:</span>
                 <span className="text-emerald-800 font-bold">PRIVATE / REVIEWABLE</span>
              </div>
              <div className="flex justify-between">
                 <span className="text-slate-700 font-bold">Limit:</span>
                 <span className="text-slate-900 font-bold">Not exact seat proof</span>
              </div>
            </div>
          </div>

          {/* Converging Arrows */}
          <div className="lg:col-span-3 flex flex-col items-center justify-center gap-3 py-4">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-900 font-bold uppercase tracking-wider">
              <span>Streams Converge</span>
              <ArrowRight className="w-4 h-4 hidden lg:block text-amber-700 animate-pulse" />
            </div>
            <div className="w-full h-2 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 rounded-full shadow-sm" />
            <div className="text-[10px] text-slate-700 text-center font-mono font-bold">
              FastAPI Core • Mutual Validation
            </div>
          </div>

          {/* Stream 2: Student Mobile Device */}
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-300 shadow-md relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-300 flex items-center justify-center text-orange-800">
                <Smartphone className="w-5 h-5 text-orange-700" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">STREAM B: Student Submission</h4>
                <span className="text-[11px] text-orange-800 font-mono font-bold">Flutter Mobile Client</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-800 font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-700 font-bold">Authenticated UID:</span>
                <span className="text-slate-900 font-bold">STU-2024-0482</span>
              </div>
              <div className="flex justify-between">
                 <span className="text-slate-700 font-bold">Evidence Input:</span>
                 <span className="text-amber-800 font-bold">4 guided frames + room image</span>
              </div>
              <div className="flex justify-between">
                 <span className="text-slate-700 font-bold">Identity:</span>
                 <span className="text-slate-900 font-bold">Encrypted enrollment comparison</span>
              </div>
              <div className="flex justify-between">
                 <span className="text-slate-700 font-bold">Liveness:</span>
                 <span className="text-emerald-800 font-bold">Guided movement + blink</span>
              </div>
            </div>
          </div>
        </div>

        {/* Central Result Engine */}
        <div className="mt-8 pt-6 border-t border-slate-200 bg-amber-50/70 p-5 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold shadow-md shadow-amber-600/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-mono text-amber-900 font-bold">ATTENDANCE VERIFICATION OUTCOME</div>
              <div className="text-sm font-bold text-slate-900">
                 Multi-Evidence Check: CONFIRMED or routed to Review Queue
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded text-xs font-mono bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold">
               Illustrative sample
            </span>
            <span className="px-2.5 py-1 rounded text-xs font-mono bg-amber-100 text-amber-950 border border-amber-300 font-bold">
               Reviewable outcome
            </span>
          </div>
        </div>
      </div>

      {/* 6 Core Verification Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pillars.map((p, idx) => {
          const Icon = p.icon;
          return (
            <div
              key={p.title}
              onClick={() => {
                soundManager.playClick();
                setActiveTab(idx);
              }}
              className={`glass-panel p-6 rounded-2xl border transition-all cursor-pointer shadow-sm ${
                activeTab === idx
                  ? "border-amber-500 bg-white ring-2 ring-amber-400/40 shadow-md"
                  : "border-slate-200 hover:border-amber-400 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center ${p.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                  {p.role}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">{p.title}</h3>
              <p className="text-xs text-slate-700 font-medium leading-relaxed">{p.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
