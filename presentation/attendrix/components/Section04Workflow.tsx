"use client";

import React, { useState } from "react";
import { soundManager } from "./SoundManager";
import {
  MonitorCheck,
  Camera,
  Layers,
  ServerCog,
  CheckCircle,
  FileCheck2,
  ChevronRight,
  ShieldAlert,
  AlertCircle,
  Clock,
} from "lucide-react";

export default function Section04Workflow() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const steps = [
    {
      step: 1,
      title: "Faculty Session Init",
      shortTitle: "1. Faculty Init",
      icon: MonitorCheck,
      color: "text-amber-700",
      bgBadge: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
       desc: "A teacher authenticates, selects an assigned class, configures the server-timed window and classroom evidence settings, then opens the session.",
      actionDetails: [
        "Loads enrolled student roster from PostgreSQL database.",
         "Creates pending attendance rows for the enrolled roster.",
         "Publishes authoritative session updates to connected clients.",
      ],
      caution: "Prevents ghost sessions; only authorized faculty can activate room capture.",
    },
    {
      step: 2,
       title: "Teacher Opens the Session",
       shortTitle: "2. Session Window",
       icon: Clock,
      color: "text-orange-700",
      bgBadge: "bg-orange-100 text-orange-900 border-orange-300 font-bold",
       desc: "The backend controls when the attendance window opens, closes, expires, and becomes read-only. The client clock is informational only.",
      actionDetails: [
         "Students may submit only when the server reports the session as open.",
         "Late, unauthorized, duplicate, and finalized submissions are rejected.",
         "A teacher can close the window before manual review and finalization.",
      ],
      caution:
         "The window controls eligibility; it is not proof of physical presence by itself.",
    },
    {
      step: 3,
      title: "Student Selfie Capture",
      shortTitle: "3. Student Selfie",
      icon: Camera,
      color: "text-amber-700",
      bgBadge: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
       desc: "Student opens the Flutter client, authenticates, and captures four real front-camera frames while following head-movement and blink prompts.",
      actionDetails: [
         "Requests camera permission and keeps the guided capture in the foreground.",
         "Submits the frames for separate liveness and identity evaluation.",
        "Prepares a single-face frame for comparison with the encrypted enrolled representation.",
      ],
      caution:
        "Low-light or motion-blurred photos prompt immediate recapture rather than false rejection.",
    },
    {
      step: 4,
      title: "Contextual Classroom Evidence",
      shortTitle: "4. Room Context",
      icon: Layers,
      color: "text-amber-700",
      bgBadge: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
       desc: "The student switches to the rear camera and captures a wide classroom view as contextual evidence.",
      actionDetails: [
         "Quality checks validate a readable, wide image.",
         "The configured person detector evaluates visible-person scene evidence.",
         "Context cannot prove an exact seat or identify every person in the hall.",
      ],
      caution:
        "TECHNICAL LIMITATION: Wide-angle panorama cannot biometrically resolve small 14x14px distant faces at 20 meters. It establishes environmental context, not individual proof.",
    },
    {
      step: 5,
      title: "Backend Validation Sequence",
      shortTitle: "5. Backend Validation",
      icon: ServerCog,
      color: "text-orange-700",
      bgBadge: "bg-orange-100 text-orange-900 border-orange-300 font-bold",
       desc: "FastAPI evaluates the three evidence categories independently before writing a server-generated attendance state.",
      actionDetails: [
        "1. Authenticate JWT token & student enrollment in course.",
        "2. Validate session status = OPEN.",
         "3. Evaluate face visibility and guided liveness evidence.",
         "4. Compare the submitted face with the encrypted enrolled representation.",
         "5. Evaluate classroom image quality and scene context.",
         "6. Enforce one verification attempt per student/session.",
         "7. Assign CONFIRMED, PENDING_REVIEW, or REJECTED with reasons.",
      ],
      caution: "Guarantees zero database race conditions using PostgreSQL unique constraints.",
    },
    {
      step: 6,
      title: "Attendance Outcome Classification",
      shortTitle: "6. Outcome Result",
      icon: CheckCircle,
      color: "text-amber-700",
      bgBadge: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
       desc: "Every record receives a server-generated status based on the separate evidence results.",
      actionDetails: [
         "CONFIRMED: identity, liveness, and classroom context all passed.",
        "PENDING REVIEW: Evidence is incomplete, inconclusive, or the configured model is unavailable.",
         "REJECTED: An explicit evidence or policy check failed.",
         "PENDING_REVIEW: Evidence is insufficient or a model is unavailable; teacher review decides.",
      ],
      caution: "Uncertain cases are NEVER automatically marked absent. Human discretion is preserved.",
    },
    {
      step: 7,
      title: "Teacher Review & Audit Record",
      shortTitle: "7. Audit & Finalize",
      icon: FileCheck2,
      color: "text-amber-700",
      bgBadge: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
      desc: "Instructor inspects unresolved cases in the review queue, evaluates student photos alongside capture timestamps, overrides if legitimate, and seals the finalized session.",
      actionDetails: [
        "Full audit trail logs instructor ID, timestamp, and rationale note.",
        "Synchronizes with university LMS / ERP export (CSV, JSON, PDF).",
        "Closes session and terminates WebSocket broadcasting channels.",
      ],
      caution: "Immutable audit log ensures accountability for all manual overrides.",
    },
  ];

  const currentStepData = steps.find((s) => s.step === activeStep) || steps[0];
  const StepIcon = currentStepData.icon;

  return (
    <section id="workflow" className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-mono text-xs font-bold mb-4 shadow-sm">
          <Clock className="w-3.5 h-3.5" />
          <span>SECTION 04 • EVIDENCE PIPELINE</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          One Session. <br />
          <span className="bg-gradient-to-r from-amber-800 via-amber-700 to-orange-700 bg-clip-text text-transparent">
            Multiple Verification Checks.
          </span>
        </h2>
        <p className="text-base sm:text-lg text-slate-700 font-medium">
           Step through the 7-stage verification workflow. See how instructor authority, real camera capture, and server-side review protect attendance integrity.
        </p>
      </div>

      {/* Horizontal Step Selector */}
      <div className="glass-panel p-2.5 rounded-2xl border border-slate-300/90 bg-white/95 mb-8 overflow-x-auto shadow-md">
        <div className="flex items-center min-w-max gap-1.5">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCurrent = s.step === activeStep;
            return (
              <button
                key={s.step}
                onClick={() => {
                  soundManager.playClick();
                  setActiveStep(s.step);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30"
                    : "text-slate-700 font-semibold hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4 text-amber-700" />
                <span>{s.shortTitle}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Step Detailed Showcase Panel */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl border border-slate-300/90 bg-white/95 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative shadow-xl">
        {/* Left Column: Visual Step Simulation */}
        <div className="lg:col-span-5 bg-slate-50/95 p-6 rounded-2xl border border-slate-200 space-y-4 shadow-inner">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-mono px-3 py-1 rounded-full border ${currentStepData.bgBadge}`}>
              STAGE 0{currentStepData.step} / 07
            </span>
            <span className="text-xs font-mono text-slate-700 font-bold">FastAPI Pipeline</span>
          </div>

          <div className="flex items-center gap-4 py-2">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shadow-sm">
              <StepIcon className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{currentStepData.title}</h3>
              <p className="text-xs text-slate-700 font-semibold">Classroom Session Orchestration</p>
            </div>
          </div>

           {/* Server-authoritative session state preview */}
           {activeStep === 2 && (
             <div className="bg-white p-4 rounded-xl border border-amber-300 font-mono text-xs space-y-2 shadow-sm">
               <div className="text-amber-800 flex justify-between font-bold">
                 <span>SERVER SESSION CLOCK:</span>
                 <span className="text-emerald-700 animate-pulse">● AUTHORITATIVE</span>
               </div>
               <div className="text-2xl font-black text-slate-900 tracking-widest text-center py-2 bg-amber-50/60 rounded border border-amber-200">
                 OPEN WINDOW
               </div>
               <div className="flex justify-between items-center text-[11px] text-slate-700 pt-1 font-bold">
                 <span>Client clock is informational</span>
                 <span className="text-orange-700 font-bold">DEADLINE ENFORCED</span>
               </div>
               <p className="text-slate-700">Scheduled, open, closed, and finalized states are checked by FastAPI before each upload.</p>
             </div>
           )}

          {/* 4 Status Outcomes Preview if Step 6 */}
          {activeStep === 6 && (
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="bg-emerald-50 border border-emerald-300 p-2.5 rounded-lg text-emerald-900">
                 <div className="font-bold">CONFIRMED</div>
                <div className="text-[10px] text-emerald-700">Checks Passed</div>
              </div>
              <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-lg text-amber-900">
                 <div className="font-bold">PENDING_REVIEW</div>
                 <div className="text-[10px] text-amber-700">Evidence Inconclusive</div>
              </div>
              <div className="bg-rose-50 border border-rose-300 p-2.5 rounded-lg text-rose-900">
                <div className="font-bold">REJECTED</div>
                <div className="text-[10px] text-rose-700">Policy Failed</div>
              </div>
              <div className="bg-orange-50 border border-orange-300 p-2.5 rounded-lg text-orange-900">
                <div className="font-bold">PENDING REVIEW</div>
                <div className="text-[10px] text-orange-700">Teacher Audit</div>
              </div>
            </div>
          )}

          {/* Step Action Details */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-mono text-slate-600 font-bold uppercase tracking-wider block">
              Automated Operations:
            </span>
            {currentStepData.actionDetails.map((action, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-700 font-mono">
                <ChevronRight className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: In-Depth Explanation & Limitations */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">{currentStepData.title}</h4>
            <p className="text-sm text-slate-700 leading-relaxed">{currentStepData.desc}</p>
          </div>

          {/* Academic & Engineering Honesty Callout */}
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl flex items-start gap-3 text-xs text-slate-700 leading-relaxed shadow-sm">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-amber-900 mb-0.5">TECHNICAL CONSIDERATION:</span>
              {currentStepData.caution}
            </div>
          </div>

          {/* Navigation between steps */}
          <div className="pt-4 flex items-center justify-between border-t border-slate-200">
            <button
              disabled={activeStep === 1}
              onClick={() => {
                soundManager.playClick();
                setActiveStep((prev) => Math.max(1, prev - 1));
              }}
              className="px-4 py-2 rounded-xl text-xs font-mono text-slate-800 hover:text-slate-950 disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-bold"
            >
              ← Previous Step
            </button>

            <span className="text-xs font-mono text-slate-700 font-bold">
              {activeStep} of {steps.length}
            </span>

            <button
              disabled={activeStep === steps.length}
              onClick={() => {
                soundManager.playClick();
                setActiveStep((prev) => Math.min(steps.length, prev + 1));
              }}
              className="px-4 py-2 rounded-xl text-xs font-mono bg-amber-600 hover:bg-amber-500 text-white font-bold disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer shadow-md shadow-amber-600/30"
            >
              <span>Next Step</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
