"use client";

import React, { useState } from "react";
import { soundManager } from "./SoundManager";
import {
  Network,
  Smartphone,
  Monitor,
  Server,
  Database,
  Cpu,
  Shield,
  FileCheck,
  Lock,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";

interface ArchNode {
  id: string;
  name: string;
  layer: string;
  tech: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
  summary: string;
  security: string;
}

export default function Section11Architecture() {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("fastapi");

  const nodes: ArchNode[] = [
    {
      id: "flutter",
      name: "Student Client App",
      layer: "Edge Client Tier",
      tech: "Flutter / Dart (Android & iOS)",
      icon: Smartphone,
      color: "text-amber-800",
      borderColor: "border-amber-400",
      summary:
        "Authenticated mobile interface that captures the front camera selfie, performs local blur checking, retrieves the student's JWT token, and sends encrypted submissions to the backend.",
      security: "Hardware keystore token storage, camera integrity check, zero persistent local photo storage.",
    },
    {
      id: "faculty",
      name: "Faculty Dashboard",
      layer: "Presentation Tier",
       tech: "React / Vite / TypeScript",
      icon: Monitor,
      color: "text-sky-800",
      borderColor: "border-sky-400",
      summary:
        "Web application used by course teachers and controllers to initialize sessions, monitor realtime submission signals, manage registry actions, and audit review cases.",
      security: "Role-Based Access Control (RBAC) enforcing 'teacher' claims via Supabase JWT.",
    },
    {
      id: "auth",
      name: "Authentication Authority",
      layer: "Identity Tier",
      tech: "Supabase Auth / PyJWT",
      icon: Lock,
      color: "text-purple-800",
      borderColor: "border-purple-400",
      summary:
        "Issues cryptographically signed JSON Web Tokens (JWT) confirming student enrollment and faculty instructional authority.",
      security: "Asymmetric HS256/RS256 signature verification, strict expiration timestamps.",
    },
    {
      id: "fastapi",
      name: "FastAPI Ingestion Backend",
      layer: "Application Tier",
      tech: "FastAPI / Python 3.11 / WebSockets",
      icon: Server,
      color: "text-emerald-800",
      borderColor: "border-emerald-400",
      summary:
        "Async service handling session windows, protected image submissions, optional vision workers, review decisions, audit events, and report generation.",
      security: "CORS isolation, payload size quotas (10MB max), rate limiting per IP.",
    },
    {
      id: "challenge",
      name: "Dynamic Session Manager",
      layer: "Temporal Security Tier",
       tech: "Server session clock & one-use WebSocket tickets",
      icon: Shield,
      color: "text-amber-800",
      borderColor: "border-amber-400",
       summary:
        "Keeps session opening, deadlines, close/finalize transitions, and one-use realtime tickets authoritative on the server.",
       security: "Server clock enforcement, role checks, idempotency constraints, and short-lived tickets.",
    },
    {
      id: "vision",
      name: "Vision Verification Engine",
      layer: "Inference Tier",
       tech: "DeepFace (optional) + OpenCV + YOLO",
      icon: Cpu,
      color: "text-blue-800",
      borderColor: "border-blue-400",
       summary:
        "Keeps identity, guided liveness, and classroom-context evidence as separate checks. The configured face model is loaded lazily and fails closed when unavailable.",
       security: "Encrypted server-side embeddings, private evidence storage, retention cleanup, and no raw liveness-frame persistence.",
    },
    {
      id: "database",
      name: "Attendance Database",
      layer: "Persistence Tier",
      tech: "Supabase PostgreSQL",
      icon: Database,
      color: "text-amber-900",
      borderColor: "border-amber-400",
      summary:
        "Stores courses, enrollment rosters, finalized attendance entries, and unique index constraints `(session_id, student_id)` preventing duplicate records.",
      security: "Row Level Security (RLS), parameterized queries, encrypted database at rest.",
    },
    {
      id: "audit",
      name: "Review & Audit Ledger",
      layer: "Governance Tier",
      tech: "Immutable Audit Log Tables",
      icon: FileCheck,
      color: "text-rose-800",
      borderColor: "border-rose-400",
      summary:
        "Maintains an auditable, append-only historical log of all instructor overrides, manual status changes, and reason notes with UTC timestamps.",
      security: "Append-only permissions, non-repudiation of instructor actions.",
    },
  ];

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[3];
  const SelectedIcon = selectedNode.icon;

  return (
    <section id="architecture" className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 font-mono text-xs mb-4">
          <Network className="w-3.5 h-3.5 text-amber-600" />
          <span>SECTION 11 • FULL SYSTEM ARCHITECTURE</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          A Verifiable Flow, <br />
          <span className="bg-gradient-to-r from-amber-800 via-amber-700 to-orange-700 bg-clip-text text-transparent">
            From Capture to Record.
          </span>
        </h2>
        <p className="text-base sm:text-lg text-slate-700 font-medium">
           Inspect how the Flutter mobile client, React/Vite dashboard, FastAPI backend, optional vision models, and PostgreSQL storage interact with explicit review boundaries.
        </p>
      </div>

      {/* Main Interactive Architecture Diagram Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
        {/* Left Column: Interactive Topology Grid of Nodes */}
        <div className="lg:col-span-8 glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
            <div>
              <span className="text-xs font-mono text-amber-700 uppercase tracking-wider block font-bold">
                DISTRIBUTED TOPOLOGY MAP
              </span>
              <h3 className="text-base font-bold text-slate-900">System Component Network</h3>
            </div>
            <span className="text-xs font-mono text-slate-700 font-bold">Click node to inspect</span>
          </div>

          {/* 3 Tier Rows */}
          <div className="space-y-6">
            {/* Tier 1: Clients */}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-700 mb-2 block font-bold">
                1. Edge Client &amp; Presentation Tier
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {nodes.slice(0, 2).map((node) => {
                  const Icon = node.icon;
                  const isSelected = selectedNodeId === node.id;
                  return (
                    <button
                      key={node.id}
                      onClick={() => {
                        soundManager.playClick();
                        setSelectedNodeId(node.id);
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? "bg-amber-50/90 border-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.2)] ring-1 ring-amber-500"
                          : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-slate-50/90 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg bg-slate-50 border border-slate-200 ${node.color}`}>
                          <Icon className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{node.name}</div>
                          <div className="text-[10px] font-mono text-slate-700 font-semibold">{node.tech}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tier 2: Ingestion, Auth & Session Services */}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-700 mb-2 block font-bold">
                2. Application, Identity &amp; Cryptographic Tier
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {nodes.slice(2, 5).map((node) => {
                  const Icon = node.icon;
                  const isSelected = selectedNodeId === node.id;
                  return (
                    <button
                      key={node.id}
                      onClick={() => {
                        soundManager.playClick();
                        setSelectedNodeId(node.id);
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? "bg-amber-50/90 border-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.2)] ring-1 ring-amber-500"
                          : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-slate-50/90 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className={`p-2 rounded-lg bg-slate-50 border border-slate-200 ${node.color}`}>
                          <Icon className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{node.name}</div>
                          <div className="text-[9px] font-mono text-slate-700 font-semibold">{node.layer}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tier 3: Inference, Persistence & Audit */}
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-700 mb-2 block font-bold">
                3. Inference &amp; Persistence Storage Tier
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {nodes.slice(5, 8).map((node) => {
                  const Icon = node.icon;
                  const isSelected = selectedNodeId === node.id;
                  return (
                    <button
                      key={node.id}
                      onClick={() => {
                        soundManager.playClick();
                        setSelectedNodeId(node.id);
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? "bg-amber-50/90 border-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.2)] ring-1 ring-amber-500"
                          : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-slate-50/90 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className={`p-2 rounded-lg bg-slate-50 border border-slate-200 ${node.color}`}>
                          <Icon className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{node.name}</div>
                          <div className="text-[9px] font-mono text-slate-700 font-semibold">{node.layer}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Node Inspector Drawer */}
        <div className="lg:col-span-4 glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <span className="text-xs font-mono text-amber-700 uppercase tracking-wider font-bold">
              COMPONENT SPECIFICATION
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 font-bold">
              ACTIVE
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600`}>
              <SelectedIcon className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900">{selectedNode.name}</h4>
              <span className="text-xs font-mono text-slate-700 font-bold">{selectedNode.tech}</span>
            </div>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="bg-white/90 p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-slate-700 uppercase text-[10px] block mb-1 font-bold">
                CORE RESPONSIBILITY:
              </span>
              <p className="text-slate-800 font-sans font-medium leading-relaxed">{selectedNode.summary}</p>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 shadow-sm">
              <span className="text-emerald-800 uppercase text-[10px] block mb-1 font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                <span>SECURITY &amp; PRIVACY GUARANTEE:</span>
              </span>
              <p className="text-emerald-900 font-sans leading-relaxed">{selectedNode.security}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Ethical Governance Callout Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-emerald-200 bg-emerald-50/70 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 mt-1">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-2 text-xs text-emerald-900 leading-relaxed font-sans">
            <h4 className="text-sm font-bold text-emerald-950">Biometric Privacy &amp; Data Governance Principles</h4>
            <p className="text-emerald-800">
              Attendrix keeps biometric representations encrypted on the server, stores classroom evidence in a private bucket, expires image access, and preserves manual review for uncertain outcomes. It is a prototype and does not claim perfect spoof prevention or legal compliance.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
