"use client";

import React, { useState } from "react";
import { soundManager } from "./SoundManager";
import {
  GitCommit,
  CheckCircle2,
  AlertOctagon,
  FileCode,
  Cpu,
  Layers,
  ArrowRight,
  Shield,
  Eye,
  Sliders,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface PipelineStage {
  id: number;
  name: string;
  shortName: string;
  tagline: string;
  purpose: string;
  input: string;
  output: string;
  failureConditions: string;
  status: "Implemented in Prototype" | "Proposed for Production";
  statusColor: string;
  codeSnippet: string;
}

export default function Section09PipelineDeepDive() {
  const [activeStageId, setActiveStageId] = useState<number>(3); // Default on Detection stage

  const stages: PipelineStage[] = [
    {
      id: 1,
      name: "Stage 1: Multi-Source Capture",
      shortName: "1. Capture",
      tagline: "Ingestion of client-side payloads and room context",
      purpose:
        "Ingests authenticated student face frames and a rear-camera classroom image over the protected multipart API.",
      input: "Multipart image frames, JWT bearer token, active session ID.",
      output: "Raw image buffer in memory, parsed metadata dict, validated student ID.",
      failureConditions: "Corrupt image format, payload size > 10MB, network transmission drop.",
      status: "Implemented in Prototype",
      statusColor: "bg-emerald-100 text-emerald-950 border-emerald-300 font-bold",
      codeSnippet: `async def submit_attendance(
    session_id: str,
    challenge_token: str,
    file: UploadFile = File(...)
):
    # Enforce MAX_CAPTURE_BYTES (10MB limit)
    contents = await file.read()
    return parse_and_enqueue(contents, challenge_token)`,
    },
    {
      id: 2,
      name: "Stage 2: Image Quality Assessment",
      shortName: "2. Quality",
      tagline: "Sharpness, luminance, and face pose validation",
      purpose:
        "Evaluates whether the student photo contains sufficient optical information before expending neural network compute. Computes Laplacian variance for motion blur.",
      input: "RGB image tensor [H, W, 3].",
      output: "Resolution, aspect ratio, brightness, and blur checks.",
      failureConditions:
        "Laplacian variance < 100 (severe blur), luminance < 30 lux (extreme underexposure), extreme profile angle (>45°).",
      status: "Implemented in Prototype",
      statusColor: "bg-emerald-100 text-emerald-950 border-emerald-300 font-bold",
      codeSnippet: `def check_image_quality(img_rgb):
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    if laplacian_var < SHARPNESS_THRESHOLD:
        return QualityResult(usable=False, reason="motion_blur")
    return QualityResult(usable=True, score=laplacian_var)`,
    },
    {
      id: 3,
      name: "Stage 3: Face Detection (OpenCV)",
      shortName: "3. Detection",
      tagline: "Candidate localization ≠ identity recognition",
      purpose:
        "Checks that each guided frame contains exactly one visible face. Detection does not identify who the person is.",
      input: "Preprocessed RGB image.",
      output: "A single-face visibility result for each guided frame.",
      failureConditions:
        "No face detected (occlusion/off-camera), multiple faces in individual selfie frame.",
      status: "Implemented in Prototype",
      statusColor: "bg-emerald-100 text-emerald-950 border-emerald-300 font-bold",
      codeSnippet: `# DETECTOR ONLY: Answers "Is a human face present here?"
detector = cv2.FaceDetectorYN.create(
    model="yunet.onnx",
    config="",
    input_size=(320, 320),
    score_threshold=0.6
)
_, faces = detector.detect(img)`,
    },
    {
      id: 4,
      name: "Stage 4: Identity Verification (configured face model)",
      shortName: "4. Identity",
      tagline: "Encrypted enrolled representation vs submitted frame",
      purpose:
        "Uses the same configured DeepFace pipeline for enrollment and verification, then compares the submitted representation with the encrypted enrolled representation.",
      input: "Aligned 112×112 face crop + reference embedding from secure database.",
      output: "A model similarity result when the configured model is available; otherwise an inconclusive state.",
      failureConditions:
        "Missing enrollment, model failure, unusable face, or similarity below the explicitly configured threshold.",
      status: "Implemented in Prototype",
      statusColor: "bg-emerald-100 text-emerald-950 border-emerald-300 font-bold",
      codeSnippet: `# Extracts 512-D unit embedding vector
emb_probe = arcface_model.forward(aligned_112x112)
# Cosine similarity: cos(theta) = u . v
cosine_sim = np.dot(emb_probe, emb_reference)
verified = (cosine_sim >= COSINE_THRESHOLD)`,
    },
    {
      id: 5,
      name: "Stage 5: Session & duplicate validation",
      shortName: "5. Validation",
      tagline: "Server time and one-attempt constraints",
      purpose:
        "Checks the server-controlled session state and enforces the unique student/session verification constraint.",
      input: "Authenticated student ID and current session ID.",
      output: "Accepted or rejected submission with an explicit reason.",
      failureConditions:
        "Session scheduled, closed, finalized, expired, or a prior attempt already exists.",
      status: "Implemented in Prototype",
      statusColor: "bg-emerald-100 text-emerald-950 border-emerald-300 font-bold",
      codeSnippet: `def validate_session_constraints(session_id, student_id, token):
    if not is_token_in_active_window(session_id, token):
        raise HTTPException(400, "Challenge token expired")
    if db.attendance_records.exists(session_id=session_id, student_id=student_id):
        raise HTTPException(409, "Duplicate submission")`,
    },
    {
      id: 6,
      name: "Stage 6: Multi-Factor Decision Policy",
      shortName: "6. Decision",
      tagline: "Separate evidence categories into a reviewable result",
      purpose:
        "Keeps identity, liveness, and classroom context separate. All three must pass for CONFIRMED; insufficient evidence becomes PENDING_REVIEW and explicit failures become REJECTED.",
      input: "Identity result, liveness result, classroom-context result, and session constraints.",
      output: "CONFIRMED, PENDING_REVIEW, or REJECTED with reasons.",
      failureConditions: "Policy configuration missing or ambiguous threshold boundaries.",
      status: "Implemented in Prototype",
      statusColor: "bg-emerald-100 text-emerald-950 border-emerald-300 font-bold",
      codeSnippet: `if not challenge_valid or is_duplicate:
    return AttendanceStatus.REJECTED
elif quality_ok and cosine_sim >= 0.72:
    return AttendanceStatus.VERIFIED
elif cosine_sim >= 0.50:
    return AttendanceStatus.PENDING_REVIEW
else:
    return AttendanceStatus.UNCERTAIN`,
    },
    {
      id: 7,
      name: "Stage 7: Teacher Review & Audit Trail",
      shortName: "7. Audit",
      tagline: "Human-in-the-loop dispute resolution and archival",
      purpose:
        "Allows authorized faculty to inspect uncertain or borderline captures, review the student's submission timestamp, override false rejections with explicit justification notes, and append an immutable entry to the audit log.",
      input: "Instructor review decision (Approve / Reject / Recapture), teacher ID, rationale text.",
      output: "Finalized attendance status and cryptographic audit log row.",
      failureConditions: "Unauthorized user attempting override without teacher role.",
      status: "Implemented in Prototype",
      statusColor: "bg-emerald-100 text-emerald-950 border-emerald-300 font-bold",
      codeSnippet: `def record_teacher_override(session_id, student_id, decision, reason):
    db.audit_logs.insert({
        "session_id": session_id,
        "student_id": student_id,
        "action": f"manual_override_{decision}",
        "actor": current_user.email,
        "timestamp": utc_now()
    })`,
    },
  ];

  const currentStage = stages.find((s) => s.id === activeStageId) || stages[0];

  return (
    <section id="pipeline" className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-mono text-xs font-bold mb-4 shadow-sm">
          <GitCommit className="w-3.5 h-3.5" />
          <span>SECTION 09 • DEEP DIVE</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          Detection Is Not <br />
          <span className="bg-gradient-to-r from-amber-800 via-amber-700 to-orange-700 bg-clip-text text-transparent">
            Identification.
          </span>
        </h2>
        <p className="text-base sm:text-lg text-slate-700 font-medium">
          The central computer-vision distinction behind Attendrix: detecting that a face exists is trivial; verifying an identity requires high biometric texture, 1-to-1 alignment, and policy-driven corroboration.
        </p>
      </div>

      {/* Horizontal Stage Navigator */}
      <div className="glass-panel p-2.5 rounded-2xl border border-slate-300/90 bg-white/95 mb-8 overflow-x-auto shadow-md">
        <div className="flex items-center min-w-max gap-1.5">
          {stages.map((stage) => {
            const isSelected = stage.id === activeStageId;
            return (
              <button
                key={stage.id}
                onClick={() => {
                  soundManager.playClick();
                  setActiveStageId(stage.id);
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-mono transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30"
                    : "text-slate-800 font-semibold hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <span>{stage.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detailed Stage Exploration Canvas */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl border border-slate-300/90 bg-white/95 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative shadow-xl">
        {/* Left Column: Stage Specifications */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-amber-800 font-bold uppercase tracking-wider">
              STAGE 0{currentStage.id} SPECIFICATION
            </span>
            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded border ${currentStage.statusColor}`}>
              {currentStage.status}
            </span>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">{currentStage.name}</h3>
            <p className="text-xs font-mono text-amber-800 font-bold">{currentStage.tagline}</p>
          </div>

          <div className="space-y-4 text-xs font-mono">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-300">
              <span className="text-slate-700 block uppercase text-[10px] mb-1 font-bold">
                ENGINEERING PURPOSE:
              </span>
              <p className="text-slate-900 font-sans font-medium leading-relaxed">{currentStage.purpose}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-300">
                <span className="text-slate-700 block uppercase text-[10px] mb-1 font-bold">
                  REQUIRED INPUT:
                </span>
                <span className="text-slate-950 font-semibold">{currentStage.input}</span>
              </div>

              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-300">
                <span className="text-emerald-900 block uppercase text-[10px] mb-1 font-bold">
                  PRODUCED OUTPUT:
                </span>
                <span className="text-emerald-950 font-bold">{currentStage.output}</span>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-300 p-3.5 rounded-xl">
              <span className="text-rose-900 block uppercase text-[10px] mb-1 font-bold">
                FAILURE CONDITIONS &amp; MITIGATION:
              </span>
              <span className="text-rose-950 font-medium">{currentStage.failureConditions}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Code Implementation Reference */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-600 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <FileCode className="w-4 h-4 text-amber-700" />
              <span>FastAPI Backend Implementation Reference</span>
            </div>
            <span className="text-[10px] text-slate-700 font-bold">Python 3.11 • OpenCV • PyTorch</span>
          </div>

          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-xs overflow-x-auto text-slate-300 leading-relaxed shadow-inner">
            <pre className="text-amber-300">{currentStage.codeSnippet}</pre>
          </div>

          {/* Theoretical Rule Callout */}
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-300 text-xs font-mono text-slate-700 space-y-2 shadow-sm">
            <div className="text-amber-900 font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-700" />
              <span>ACADEMIC INTEGRITY NOTICE</span>
            </div>
            <p className="text-[11px] text-slate-800 font-medium leading-relaxed font-sans">
              This presentation labels interface values as illustrative. The working pipeline keeps face detection, liveness, identity comparison, and classroom context separate, and returns an inconclusive review state when required models or evidence are unavailable.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
