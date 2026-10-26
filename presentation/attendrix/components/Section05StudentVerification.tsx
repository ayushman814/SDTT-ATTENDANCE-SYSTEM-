"use client";

import React, { useState } from "react";
import { soundManager } from "./SoundManager";
import confetti from "canvas-confetti";
import {
  ShieldCheck,
  Camera,
  UserCheck,
  AlertTriangle,
  XCircle,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  Lock,
  ScanFace,
  Fingerprint,
} from "lucide-react";

type ScenarioKey = "valid" | "poor_quality" | "expired_token" | "duplicate" | "uncertain_match";

interface ScenarioConfig {
  key: ScenarioKey;
  label: string;
  badge: string;
  badgeColor: string;
  qualityScore: number;
  challengeMatch: boolean;
  cosineSimilarity: number;
  isDuplicate: boolean;
  outcomeStatus: "CONFIRMED" | "UNCERTAIN" | "REJECTED" | "PENDING REVIEW";
  outcomeMessage: string;
  outcomeExplanation: string;
}

const scenarios: Record<ScenarioKey, ScenarioConfig> = {
  valid: {
    key: "valid",
    label: "1. Valid Illustrative Submission",
    badge: "IDEAL FLOW",
    badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold",
    qualityScore: 94,
    challengeMatch: true,
    cosineSimilarity: 0.86,
    isDuplicate: false,
    outcomeStatus: "CONFIRMED",
    outcomeMessage: "All configured demo checks passed.",
    outcomeExplanation:
      "Illustrative demo: identity, guided liveness, and classroom-context checks all pass. Production outcomes come from the configured server pipeline.",
  },
  poor_quality: {
    key: "poor_quality",
    label: "2. Poor-Quality Image (Motion Blur)",
    badge: "QUALITY FAILURE",
    badgeColor: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
    qualityScore: 32,
    challengeMatch: true,
    cosineSimilarity: 0.48,
    isDuplicate: false,
    outcomeStatus: "UNCERTAIN",
    outcomeMessage: "Insufficient image quality. Retry or use the approved alternative.",
    outcomeExplanation:
      "Laplacian variance indicates severe motion blur. Image quality score (32/100) below acceptable threshold (70/100). System prompts student for immediate recapture.",
  },
  expired_token: {
    key: "expired_token",
    label: "3. Closed Session Window",
    badge: "SESSION CLOSED",
    badgeColor: "bg-rose-100 text-rose-900 border-rose-300 font-bold",
    qualityScore: 91,
    challengeMatch: false,
    cosineSimilarity: 0.88,
    isDuplicate: false,
    outcomeStatus: "REJECTED",
    outcomeMessage: "Challenge expired. Refresh the session evidence.",
    outcomeExplanation:
      "The server rejects submissions when the attendance window is closed or expired. Client timestamps cannot override the session state.",
  },
  duplicate: {
    key: "duplicate",
    label: "4. Duplicate Submission Attempt",
    badge: "DUPLICATE REPLAY",
    badgeColor: "bg-rose-100 text-rose-900 border-rose-300 font-bold",
    qualityScore: 95,
    challengeMatch: true,
    cosineSimilarity: 0.89,
    isDuplicate: true,
    outcomeStatus: "REJECTED",
    outcomeMessage: "A record already exists for this student and session.",
    outcomeExplanation:
      "Student ID STU-2024-0482 already holds a committed attendance record for session #8491. Deduplication constraint rejects re-submission.",
  },
  uncertain_match: {
    key: "uncertain_match",
    label: "5. Uncertain Identity (Marginal Cosine)",
    badge: "HUMAN AUDIT REQUIRED",
    badgeColor: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
    qualityScore: 82,
    challengeMatch: true,
    cosineSimilarity: 0.58,
    isDuplicate: false,
    outcomeStatus: "PENDING REVIEW",
    outcomeMessage: "No automatic final decision. Teacher review required.",
    outcomeExplanation:
      "The illustrative identity evidence is inconclusive. Rather than inventing a final result, the case is routed to the teacher review queue.",
  },
};

export default function Section05StudentVerification() {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>("valid");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(4);

  const scenario = scenarios[selectedScenario];

  const runSimulation = () => {
    soundManager.playClick();
    setIsRunning(true);
    setCurrentStepIndex(0);

    const steps = [1, 2, 3, 4];
    steps.forEach((step, i) => {
      setTimeout(() => {
        setCurrentStepIndex(step);
        soundManager.playScan();
        if (step === 4) {
          setIsRunning(false);
           if (scenario.outcomeStatus === "CONFIRMED") {
            soundManager.playSuccess();
            confetti({
              particleCount: 55,
              spread: 60,
              origin: { y: 0.7 },
              colors: ["#d97706", "#f59e0b", "#fbbf24", "#059669"],
            });
          } else {
            soundManager.playWarning();
          }
        }
      }, (i + 1) * 750);
    });
  };

  const selectScenario = (key: ScenarioKey) => {
    soundManager.playClick();
    setSelectedScenario(key);
    setCurrentStepIndex(4);
    setIsRunning(false);
  };

  return (
    <section id="verification" className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-mono text-xs font-bold mb-4 shadow-sm">
          <ScanFace className="w-3.5 h-3.5" />
          <span>SECTION 05 • INDIVIDUAL EVALUATION</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Every Record Has a <br />
          <span className="bg-gradient-to-r from-amber-800 via-amber-700 to-orange-700 bg-clip-text text-transparent">
            Verifiable Reason.
          </span>
        </h2>
        <p className="text-base sm:text-lg text-slate-700 font-medium">
           Explore how an individual student’s attendance evidence is evaluated.
           Switch between 5 illustrative scenarios to observe quality failures, closed sessions, duplicate prevention, and pending review.
        </p>
      </div>

      {/* Scenario Selector Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 mb-10">
        {(Object.keys(scenarios) as ScenarioKey[]).map((key) => {
          const s = scenarios[key];
          const isSelected = selectedScenario === key;
          return (
            <button
              key={key}
              onClick={() => selectScenario(key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-mono transition-all border cursor-pointer ${
                isSelected
                  ? "bg-amber-600 text-white font-bold border-amber-600 shadow-md shadow-amber-600/30 ring-2 ring-amber-400/40"
                  : "bg-white text-slate-800 font-semibold border-slate-300 hover:border-amber-500 hover:text-slate-900 shadow-sm"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Main Interactive Student Verification Workbench */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl border border-slate-300/90 bg-white/95 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative shadow-xl">
        {/* Left Column: Stylized Camera View & Student Identity */}
        <div className="lg:col-span-5 space-y-4">
          {/* Simulated Mobile Camera Viewport */}
          <div className="relative aspect-[4/3] rounded-2xl bg-slate-950 border-2 border-slate-800 overflow-hidden flex flex-col items-center justify-center p-4 shadow-inner">
            {/* Camera Overlay Elements */}
            <div className="absolute top-3 left-3 flex items-center gap-2 text-[10px] font-mono text-amber-400 bg-slate-900/90 px-2.5 py-1 rounded border border-amber-500/30">
              <Camera className="w-3 h-3 text-amber-400" />
              <span>FRONT CAM • 112×112 ROI</span>
            </div>

            <div className="absolute top-3 right-3 text-[10px] font-mono text-amber-300 bg-slate-900/90 px-2 py-1 rounded border border-amber-500/30">
              ISO 200 • 60 FPS
            </div>

            {/* Stylized Face Silhouette / Landmark Box */}
            <div
              className={`relative w-36 h-44 rounded-3xl border-2 transition-all flex flex-col items-center justify-center ${
                selectedScenario === "poor_quality"
                  ? "border-orange-500/60 blur-[1.5px] bg-orange-950/20"
                  : selectedScenario === "valid"
                  ? "border-amber-400/80 bg-amber-950/20 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                  : "border-stone-700 bg-stone-900/30"
              }`}
            >
              {/* Scanline Animation if running */}
              {isRunning && (
                <div className="absolute inset-x-0 h-1 bg-amber-400 shadow-[0_0_12px_#fbbf24] animate-scanline" />
              )}

              {/* Face Landmark Markers */}
              <div className="w-20 h-28 rounded-full border border-dashed border-amber-400/40 flex flex-col items-center justify-center">
                <div className="flex gap-6 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60 mb-2" />
                <div className="w-6 h-1 rounded-full bg-amber-400/80" />
              </div>

              <div className="absolute bottom-2 text-[9px] font-mono text-amber-300 uppercase tracking-widest font-bold">
                {selectedScenario === "poor_quality" ? "BLUR DETECTED" : "FACE ALIGNED"}
              </div>
            </div>

             {/* Server session state banner */}
            <div className="absolute bottom-3 inset-x-3 bg-slate-900/95 border border-slate-800 rounded-lg p-2 flex items-center justify-between text-xs font-mono">
                 <span className="text-slate-300 font-bold">Session Window:</span>
              <span
                className={`font-bold ${
                  scenario.challengeMatch ? "text-amber-300" : "text-rose-400 line-through"
                }`}
              >
                 {scenario.challengeMatch ? "OPEN (SERVER CHECK)" : "CLOSED / EXPIRED"}
              </span>
            </div>
          </div>

          {/* Student Reference Identity Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 font-bold text-sm">
                AS
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Aarav Sharma</div>
                <div className="text-[11px] font-mono text-slate-700 font-semibold">ID: STU-2024-0482 • B.Tech CS</div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 block mb-0.5 font-bold">
                512-D ARCFACE
              </span>
              <span className="text-[10px] text-slate-700 font-mono font-semibold">Registered Ref</span>
            </div>
          </div>
        </div>

        {/* Right Column: Verification Stages & Decision */}
        <div className="lg:col-span-7 space-y-5">
          {/* Action Header with Run Demo Button */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs font-mono text-amber-800 font-bold uppercase tracking-wider mb-1">
                EVALUATION PIPELINE
              </div>
              <h3 className="text-lg font-bold text-slate-900">{scenario.label}</h3>
            </div>

            <button
              disabled={isRunning}
              onClick={runSimulation}
              className="px-4 py-2.5 rounded-xl text-xs font-mono font-bold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-2 transition-all shadow-md shadow-amber-600/30 disabled:opacity-50 cursor-pointer"
            >
              {isRunning ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Evaluating Checks...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Verification Demo</span>
                </>
              )}
            </button>
          </div>

          {/* 4 Sequential Verification Step Cards */}
          <div className="space-y-2.5">
            {/* Step 1: Session & Challenge Check */}
            <div
              className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between transition-colors ${
                currentStepIndex >= 1
                  ? scenario.challengeMatch
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-rose-50 border-rose-300 text-rose-900"
                  : "bg-slate-100 border-slate-300 text-slate-700 font-semibold"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4" />
                <span>1. Session State &amp; Duplicate Policy</span>
              </div>
              <span className="font-bold">
                {currentStepIndex >= 1
                  ? scenario.challengeMatch
                    ? "PASS (TTL Valid)"
                    : "FAIL (Window Closed)"
                  : "WAITING"}
              </span>
            </div>

            {/* Step 2: Quality & Sharpness Check */}
            <div
              className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between transition-colors ${
                currentStepIndex >= 2
                  ? scenario.qualityScore >= 70
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-amber-50 border-amber-300 text-amber-900"
                  : "bg-slate-100 border-slate-300 text-slate-700 font-semibold"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Camera className="w-4 h-4" />
                <span>2. Face Sharpness &amp; Illumination</span>
              </div>
              <span className="font-bold">
                {currentStepIndex >= 2
                  ? `${scenario.qualityScore}/100 (${
                      scenario.qualityScore >= 70 ? "Sharp" : "Blurred"
                    })`
                  : "WAITING"}
              </span>
            </div>

            {/* Step 3: Biometric 1:1 Cosine Similarity */}
            <div
              className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between transition-colors ${
                currentStepIndex >= 3
                  ? scenario.cosineSimilarity >= 0.72
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : scenario.cosineSimilarity >= 0.5
                    ? "bg-amber-50 border-amber-300 text-amber-900"
                    : "bg-rose-50 border-rose-300 text-rose-900"
                  : "bg-slate-100 border-slate-300 text-slate-700 font-semibold"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Fingerprint className="w-4 h-4" />
                 <span>3. Configured Identity Model Result</span>
              </div>
              <span className="font-bold">
                {currentStepIndex >= 3
                     ? `${scenario.cosineSimilarity.toFixed(2)} illustrative model output`
                  : "WAITING"}
              </span>
            </div>

            {/* Step 4: Duplicate Record Constraint */}
            <div
              className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between transition-colors ${
                currentStepIndex >= 4
                  ? !scenario.isDuplicate
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-rose-50 border-rose-300 text-rose-900"
                  : "bg-slate-100 border-slate-300 text-slate-700 font-semibold"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4" />
                <span>4. Database Deduplication Check</span>
              </div>
              <span className="font-bold">
                {currentStepIndex >= 4
                  ? !scenario.isDuplicate
                    ? "PASS (Unique Record)"
                    : "FAIL (Duplicate Entry)"
                  : "WAITING"}
              </span>
            </div>
          </div>

          {/* Final Outcome Box */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
               scenario.outcomeStatus === "CONFIRMED"
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : scenario.outcomeStatus === "PENDING REVIEW"
                ? "bg-amber-50 border-amber-300 text-amber-900"
                : scenario.outcomeStatus === "UNCERTAIN"
                ? "bg-amber-50 border-amber-300 text-amber-900"
                : "bg-rose-50 border-rose-300 text-rose-900"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider font-bold">
               ILLUSTRATIVE CLASSIFICATION: {scenario.outcomeStatus}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/70 border border-current font-semibold">
                SIMULATED DEMO RESULT
              </span>
            </div>
            <p className="text-sm font-bold mb-1">{scenario.outcomeMessage}</p>
            <p className="text-xs opacity-90 leading-relaxed font-sans">{scenario.outcomeExplanation}</p>
          </div>

          {/* Academic Integrity Callout */}
          <div className="text-[11px] text-slate-600 font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
            *Technical honesty notice: Simulated demonstration scores. 1-to-1 biometric verification tests whether this specific student matches their own registered record, which is mathematically distinct from scanning 240 faces in an amphitheater panorama.
          </div>
        </div>
      </div>
    </section>
  );
}
