"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { soundManager } from "./SoundManager";
import {
  Maximize2,
  Camera,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Smartphone,
  Scan,
  Compass,
  Sparkles,
  Layers,
  Laptop,
  BookOpen,
  Wifi,
  ShieldCheck,
  Hash,
  X,
} from "lucide-react";

interface LectureHallSceneProps {
  scrollProgress: number; // 0 to 1
  activeSection: string;
  isReducedMotion?: boolean;
  selectedCohort?: 80 | 120 | 240;
  activeZone?: "all" | "zoneA" | "zoneB" | "zoneC";
}

interface StudentSeatData {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  z: number;
  zone: "zoneA" | "zoneB" | "zoneC";
  targetStatus: "verified" | "pending" | "unrecorded";
  activationScroll: number;
  bodyColor: THREE.Color;
  headColor: THREE.Color;
  name: string;
  studentId: string;
  confidence: number;
  scanTime: string;
  hasLaptop: boolean;
  hasNotebook: boolean;
}

export default function LectureHallScene({
  scrollProgress,
  activeSection,
  isReducedMotion = false,
  selectedCohort = 240,
  activeZone = "all",
}: LectureHallSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [show2DOverlay, setShow2DOverlay] = useState<boolean>(false);
  const [hoveredSeat, setHoveredSeat] = useState<StudentSeatData | null>(null);
  const [currentVantageName, setCurrentVantageName] = useState<string>("STAGE OVERVIEW");
  const [liveVerifiedCount, setLiveVerifiedCount] = useState<number>(0);

  // Dynamic prop references for persistent render loop (never triggers re-mount or scene destruction!)
  const scrollProgressRef = useRef(scrollProgress);
  const selectedCohortRef = useRef(selectedCohort);
  const activeZoneRef = useRef(activeZone);
  const activeSectionRef = useRef(activeSection);
  const currentSmoothProgress = useRef(scrollProgress);
  const lastVerifiedCountRef = useRef(0);
  const mousePos = useRef({ x: 0, y: 0 });

  // References to three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Instanced Meshes
  const instancedSeatsRef = useRef<THREE.InstancedMesh | null>(null);
  const instancedBackrestsRef = useRef<THREE.InstancedMesh | null>(null);
  const instancedTorsosRef = useRef<THREE.InstancedMesh | null>(null);
  const instancedHeadsRef = useRef<THREE.InstancedMesh | null>(null);
  const instancedLaptopsRef = useRef<THREE.InstancedMesh | null>(null);
  const instancedLaptopScreensRef = useRef<THREE.InstancedMesh | null>(null);
  const instancedPhonesRef = useRef<THREE.InstancedMesh | null>(null);
  const instancedScreensRef = useRef<THREE.InstancedMesh | null>(null);
  const instancedHalosRef = useRef<THREE.InstancedMesh | null>(null);

  // Featured Close-up Student (#28) objects
  const featuredPhoneRef = useRef<THREE.Mesh | null>(null);
  const featuredLaserRef = useRef<THREE.Mesh | null>(null);
  const featuredCheckmarkRef = useRef<THREE.Group | null>(null);

  // Projector Canvas Screen Texture
  const screenTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Data Network Beams
  const dataBeamsRef = useRef<THREE.LineSegments | null>(null);

  // Camera Target Vectors
  const currentLookAt = useRef(new THREE.Vector3(0, 2.6, -4));

  // Sync props to refs whenever they change (lightweight, zero re-renders of 3D scene)
  useEffect(() => {
    scrollProgressRef.current = scrollProgress;
    selectedCohortRef.current = selectedCohort;
    activeZoneRef.current = activeZone;
    activeSectionRef.current = activeSection;
  }, [scrollProgress, selectedCohort, activeZone, activeSection]);

  // 240 student seats metadata definition
  const seatsData = useRef<StudentSeatData[]>([]);

  // Initialize 240 seats and student roster
  if (seatsData.current.length === 0) {
    const totalRows = 12;
    const seatsPerRow = 20;
    let idCounter = 1;

    const studentNames = [
      "Alex Chen", "Maya Patel", "Liam Wright", "Chloe Zhang", "Ethan Davis",
      "Sofia Rodriguez", "Noah Kim", "Emma Watson", "Lucas Silva", "Olivia Taylor",
      "Aarav Sharma", "Ananya Iyer", "Rohan Mehta", "Diya Patel", "Kavya Nair",
      "Aditya Verma", "Ishaan Roy", "Pooja Reddy", "Vikram Joshi", "Meera Sen",
      "Siddharth Das", "Neha Gupta", "Arjun Nair", "Tanvi Shah", "Karan Malhotra"
    ];

    const clothingColors = [
      new THREE.Color("#1e3a8a"), // Deep Navy
      new THREE.Color("#334155"), // Slate Graphite
      new THREE.Color("#991b1b"), // Terracotta Red
      new THREE.Color("#d97706"), // Warm Amber
      new THREE.Color("#065f46"), // Forest Emerald
      new THREE.Color("#3730a3"), // Royal Indigo
      new THREE.Color("#475569"), // Heather Slate
      new THREE.Color("#78350f"), // Warm Walnut
      new THREE.Color("#0284c7"), // Cerulean
      new THREE.Color("#52525b"), // Neutral Zinc
    ];

    const hairColors = [
      new THREE.Color("#18181b"),
      new THREE.Color("#27272a"),
      new THREE.Color("#451a03"),
      new THREE.Color("#713f12"),
      new THREE.Color("#3f3f46"),
    ];

    for (let r = 0; r < totalRows; r++) {
      const zone: "zoneA" | "zoneB" | "zoneC" =
        r < 4 ? "zoneA" : r < 8 ? "zoneB" : "zoneC";

      // Realistic amphitheater alignment: Steps start from the board at stage level and increase in elevation towards the back
      const rowElevation = 0.35 + r * 0.45;
      const rowZ = -3.2 + r * 1.55;

      for (let c = 0; c < seatsPerRow; c++) {
        let x = (c - 9.5) * 0.96;
        if (c < 5) x -= 0.65;
        else if (c >= 15) x += 0.65;

        // Subtle realistic amphitheater tiered curvature focusing towards the front board
        const curveOffset = Math.pow((c - 9.5) * 0.09, 2) * 0.38;
        const z = rowZ + curveOffset;

        // Reconciled target status: 218 verified, 12 pending, 10 unrecorded (vacant chairs)
        let targetStatus: "verified" | "pending" | "unrecorded" = "verified";
        if (idCounter % 20 === 7) targetStatus = "pending";
        else if (idCounter % 24 === 0) targetStatus = "unrecorded";

        // Natural attendance activation distribution tied to scroll progress
        let activationScroll = 0.08;
        if (idCounter === 28) {
          // Alex Chen (Seat #28, Row 2, Col 8) activates right when camera zooms in close!
          activationScroll = 0.42;
        } else if (zone === "zoneA") {
          const localProgress = ((r * seatsPerRow + c) / 80);
          activationScroll = 0.08 + localProgress * 0.44;
        } else if (zone === "zoneB") {
          const localProgress = (((r - 4) * seatsPerRow + c) / 80);
          activationScroll = 0.52 + localProgress * 0.20;
        } else {
          const localProgress = (((r - 8) * seatsPerRow + c) / 80);
          activationScroll = 0.72 + localProgress * 0.16;
        }

        const name = studentNames[(idCounter - 1) % studentNames.length];
        const studentId = `STU-2024-${String(idCounter).padStart(4, "0")}`;
        const confidence = parseFloat((0.88 + (idCounter % 12) * 0.01).toFixed(2));
        const scanSec = 12 + (idCounter % 46);
        const scanTime = `09:02:${String(scanSec).padStart(2, "0")}`;

        const hasLaptop = targetStatus !== "unrecorded" && (idCounter % 2 === 0 || idCounter % 5 === 0);
        const hasNotebook = targetStatus !== "unrecorded" && !hasLaptop && (idCounter % 3 === 0);

        seatsData.current.push({
          id: idCounter,
          row: r + 1,
          col: c + 1,
          x,
          y: rowElevation + 0.3,
          z,
          zone,
          targetStatus,
          activationScroll,
          bodyColor: clothingColors[idCounter % clothingColors.length],
          headColor: hairColors[idCounter % hairColors.length],
          name,
          studentId,
          confidence,
          scanTime,
          hasLaptop,
          hasNotebook,
        });

        idCounter++;
      }
    }
  }

  // Camera flight waypoints synchronized with presentation sections
  const waypoints = [
    {
      p: 0.00,
      pos: [0, 6.8, 19.5],
      look: [0, 2.8, -6.5],
      fov: 48,
      name: "CAM 01 // STAGE OVERVIEW",
    },
    {
      p: 0.16,
      pos: [4.2, 1.8, -0.2],
      look: [-1.2, 1.6, -7.5],
      fov: 46,
      name: "CAM 02 // LOW DESK ANGLE",
    },
    {
      p: 0.32,
      pos: [-8.8, 3.6, 2.2],
      look: [1.5, 2.0, -4.5],
      fov: 46,
      name: "CAM 03 // DIAGONAL FLANK",
    },
    {
      p: 0.46,
      // Intimate over-the-shoulder macro close-up of Student #28 (Row 2, Col 8) scanning!
      pos: [-1.90, 1.62, -0.92],
      look: [-1.44, 1.48, -2.6],
      fov: 38,
      name: "CAM 04 // STUDENT MACRO POV [ACTIVE SCAN]",
    },
    {
      p: 0.60,
      pos: [-7.5, 5.2, 6.8],
      look: [1.2, 2.2, -3.0],
      fov: 48,
      name: "CAM 05 // COHORT 80 ELEVATED",
    },
    {
      p: 0.74,
      pos: [8.5, 6.8, 9.8],
      look: [-1.0, 2.6, -2.5],
      fov: 50,
      name: "CAM 06 // COHORT 120 ORBIT",
    },
    {
      p: 0.86,
      pos: [0, 8.8, 19.5],
      look: [0, 2.8, -7.5],
      fov: 54,
      name: "CAM 07 // BALCONY PANORAMA 240",
    },
    {
      p: 0.95,
      pos: [5.0, 10.5, 12.0],
      look: [0, 2.2, -2.0],
      fov: 52,
      name: "CAM 08 // TOPOLOGY EDGE NETWORK",
    },
    {
      p: 1.00,
      pos: [0, 5.8, 17.5],
      look: [0, 2.5, -5.5],
      fov: 48,
      name: "CAM 09 // CLOSING HORIZON",
    },
  ];

  // Continuous C1 Hermite camera interpolation along the rail
  const getCameraTrajectory = (p: number) => {
    const clamped = Math.min(1, Math.max(0, p));
    let idx = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      if (clamped >= waypoints[i].p && clamped <= waypoints[i + 1].p) {
        idx = i;
        break;
      }
    }

    const w0 = waypoints[idx];
    const w1 = waypoints[idx + 1] || waypoints[waypoints.length - 1];
    const range = (w1.p - w0.p) || 1;
    const rawT = (clamped - w0.p) / range;
    const smoothT = rawT * rawT * (3 - 2 * rawT);

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    return {
      pos: new THREE.Vector3(
        lerp(w0.pos[0], w1.pos[0], smoothT),
        lerp(w0.pos[1], w1.pos[1], smoothT),
        lerp(w0.pos[2], w1.pos[2], smoothT)
      ),
      look: new THREE.Vector3(
        lerp(w0.look[0], w1.look[0], smoothT),
        lerp(w0.look[1], w1.look[1], smoothT),
        lerp(w0.look[2], w1.look[2], smoothT)
      ),
      fov: lerp(w0.fov, w1.fov, smoothT),
      name: rawT > 0.5 ? w1.name : w0.name,
    };
  };

  // Draw procedural blackboard graphics (real chalkboard diagrams)
  const drawChalkboards = (
    leftCanvas: HTMLCanvasElement,
    rightCanvas: HTMLCanvasElement
  ) => {
    const ctxL = leftCanvas.getContext("2d");
    if (ctxL) {
      ctxL.fillStyle = "#1e293b";
      ctxL.fillRect(0, 0, 512, 384);

      ctxL.fillStyle = "rgba(255, 255, 255, 0.05)";
      for (let i = 0; i < 400; i++) {
        ctxL.fillRect(Math.random() * 512, Math.random() * 384, 1.5, 1.5);
      }

      ctxL.fillStyle = "#fef08a";
      ctxL.font = "bold 20px monospace";
      ctxL.fillText("ARCFACE ANGULAR MARGIN LOSS", 25, 45);

      ctxL.fillStyle = "#ffffff";
      ctxL.font = "15px monospace";
      ctxL.fillText("L = -log [ e^(s·cos(θ + m)) / Z ]", 25, 85);
      ctxL.fillText("s = 64.0 (hypersphere radius)", 25, 115);
      ctxL.fillText("m = 0.50 (additive angular margin)", 25, 140);
      ctxL.fillText("Cosine threshold τ = 0.78", 25, 165);

      ctxL.strokeStyle = "#38bdf8";
      ctxL.lineWidth = 2.5;
      ctxL.beginPath();
      ctxL.arc(140, 270, 75, -Math.PI * 0.8, -Math.PI * 0.1);
      ctxL.stroke();

      ctxL.strokeStyle = "#f59e0b";
      ctxL.setLineDash([4, 4]);
      ctxL.beginPath();
      ctxL.arc(140, 270, 75, -Math.PI * 0.65, -Math.PI * 0.25);
      ctxL.stroke();
      ctxL.setLineDash([]);

      ctxL.fillStyle = "#94a3b8";
      ctxL.font = "12px monospace";
      ctxL.fillText("Feature Embedding Space S²", 250, 240);
      ctxL.fillText("FAR: 0.0001% @ FRR: 1.14%", 250, 270);
      ctxL.fillText("Normalized L2 Euclidean Ball", 250, 300);
      ctxL.fillText("Latency: 18.4ms / face (Orin Nano)", 250, 330);
    }

    const ctxR = rightCanvas.getContext("2d");
    if (ctxR) {
      ctxR.fillStyle = "#1e293b";
      ctxR.fillRect(0, 0, 512, 384);

      ctxR.fillStyle = "rgba(255, 255, 255, 0.05)";
      for (let i = 0; i < 400; i++) {
        ctxR.fillRect(Math.random() * 512, Math.random() * 384, 1.5, 1.5);
      }

      ctxR.fillStyle = "#6ee7b7";
      ctxR.font = "bold 20px monospace";
      ctxR.fillText("EDGE GATEWAY TOPOLOGY", 25, 45);

      ctxR.fillStyle = "#ffffff";
      ctxR.font = "15px monospace";
      ctxR.fillText("1. Server-Timed Session Window", 25, 85);
      ctxR.fillText("2. Guided Identity + Liveness Frames", 25, 115);
      ctxR.fillText("3. Rear-Camera Classroom Context", 25, 140);
      ctxR.fillText("4. Audited Review and Finalization", 25, 165);

      ctxR.strokeStyle = "#f59e0b";
      ctxR.lineWidth = 2;
      ctxR.strokeRect(40, 220, 110, 55);
      ctxR.strokeRect(200, 220, 110, 55);
      ctxR.strokeRect(360, 220, 110, 55);

      ctxR.fillStyle = "#ffffff";
      ctxR.font = "12px monospace";
      ctxR.fillText("STUDENT", 65, 245);
      ctxR.fillText("DEVICE", 68, 262);

      ctxR.fillText("EDGE LECTERN", 212, 245);
      ctxR.fillText("JETSON ORIN", 216, 262);

      ctxR.fillText("CENTRAL DB", 378, 245);
      ctxR.fillText("AUDIT LOG", 382, 262);

      ctxR.beginPath();
      ctxR.moveTo(150, 247);
      ctxR.lineTo(200, 247);
      ctxR.moveTo(310, 247);
      ctxR.lineTo(360, 247);
      ctxR.stroke();

      ctxR.fillStyle = "#38bdf8";
      ctxR.font = "13px monospace";
      ctxR.fillText("Batch Ingestion: 240 seats / 4.8s total", 40, 325);
      ctxR.fillText("Zero Proxy Bypass Guarantee", 40, 350);
    }
  };

  // Redraw the 3D Center Projector Canvas Texture in real-time
  const updateProjectorCanvas = (verifiedCount: number, timeRatio: number, currentProgress: number) => {
    const canvas = screenCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1024, 512);

    ctx.strokeStyle = "rgba(217, 119, 6, 0.12)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 1024; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
    }
    for (let j = 0; j < 512; j += 64) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(1024, j);
      ctx.stroke();
    }

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 38px 'Inter', sans-serif";
    ctx.fillText("ATTENDRIX // LECTURE HALL A", 60, 75);

    ctx.fillStyle = "#b45309";
    ctx.font = "bold 20px monospace";
    ctx.fillText("SESSION #8491 • CS-401 ADVANCED ALGORITHMS • LIVE RECONCILIATION", 60, 115);

    ctx.fillStyle = "rgba(245, 158, 11, 0.08)";
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(60, 140, 520, 160, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 52px monospace";
    ctx.fillText("SESSION: SERVER-TIMED", 90, 215);

    const ttlSeconds = Math.max(1, 15 - Math.floor((timeRatio * 4) % 15));
    ctx.fillStyle = "#059669";
    ctx.font = "bold 22px monospace";
    ctx.fillText(`● DYNAMIC CLASSROOM TOKEN • TTL: ${ttlSeconds}s`, 90, 265);

    ctx.beginPath();
    ctx.arc(520, 220, 28, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(5, 150, 105, 0.2)";
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(520, 220, 28, -Math.PI / 2, -Math.PI / 2 + (ttlSeconds / 15) * Math.PI * 2);
    ctx.strokeStyle = "#059669";
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.fillStyle = "rgba(241, 245, 249, 0.9)";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(610, 60, 360, 240, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#334155";
    ctx.font = "bold 15px monospace";
    ctx.fillText("LIVE SEATING TOPOLOGY MAP (240)", 630, 95);

    const miniRows = 12;
    const miniCols = 20;
    const dotSpacingX = 15;
    const dotSpacingY = 12;
    const startX = 635;
    const startY = 120;

    let seatIdx = 0;
    for (let mr = 0; mr < miniRows; mr++) {
      for (let mc = 0; mc < miniCols; mc++) {
        const student = seatsData.current[seatIdx];
        if (student) {
          const isMarked = currentProgress >= student.activationScroll;
          if (isMarked) {
            ctx.fillStyle = student.targetStatus === "verified" ? "#10b981" : "#f59e0b";
          } else {
            ctx.fillStyle = "#cbd5e1";
          }
          ctx.beginPath();
          ctx.arc(startX + mc * dotSpacingX, startY + mr * dotSpacingY, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        seatIdx++;
      }
    }

    ctx.fillStyle = "rgba(15, 23, 42, 0.04)";
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(60, 330, 910, 140, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 48px 'Inter', sans-serif";
    ctx.fillText(`${verifiedCount}`, 90, 405);

    ctx.fillStyle = "#64748b";
    ctx.font = "bold 20px monospace";
    ctx.fillText("/ 240 ENROLLED", 180, 405);

    const percent = ((verifiedCount / 240) * 100).toFixed(1);
    ctx.fillStyle = "#059669";
    ctx.font = "bold 32px monospace";
    ctx.fillText(`${percent}% VERIFIED`, 420, 405);

    const barWidth = 840;
    const fillWidth = (verifiedCount / 240) * barWidth;
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.roundRect(90, 430, barWidth, 16, 8);
    ctx.fill();

    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.roundRect(90, 430, Math.max(16, fillWidth), 16, 8);
    ctx.fill();

    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#059669";
    ctx.fillText(`● ${verifiedCount} VERIFIED`, 680, 375);

    const pendingCount = currentProgress > 0.4 ? 12 : 0;
    ctx.fillStyle = "#d97706";
    ctx.fillText(`● ${pendingCount} REVIEW`, 820, 375);

    if (screenTextureRef.current) {
      screenTextureRef.current.needsUpdate = true;
    }
  };

  // Main Three.js Scene Setup (Guaranteed strictly once on mount!)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color("#f1f5f9");
    scene.fog = new THREE.Fog("#e2e8f0", 35, 95);

    // Camera - initialize at starting waypoint
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 140);
    const startTraj = getCameraTrajectory(scrollProgressRef.current);
    camera.position.copy(startTraj.pos);
    currentLookAt.current.copy(startTraj.look);
    camera.lookAt(currentLookAt.current);
    cameraRef.current = camera;

    // High performance WebGL Renderer with crisp tone mapping
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false, // Crisp solid background for punchy contrast
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0xf1f5f9, 1);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // ==========================================
    // LIGHTING (Warm Natural University Daylight)
    // ==========================================
    const ambientLight = new THREE.AmbientLight("#ffffff", 1.85);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight("#ffffff", "#f1f5f9", 1.4);
    scene.add(hemiLight);

    // Sunlight through tall left side windows
    const sunKey = new THREE.DirectionalLight("#fffbeb", 2.8);
    sunKey.position.set(16, 24, 18);
    scene.add(sunKey);

    const windowFill = new THREE.DirectionalLight("#e0f2fe", 1.3);
    windowFill.position.set(-18, 14, 8);
    scene.add(windowFill);

    // Stage overhead spotlight
    const stageSpot = new THREE.SpotLight("#f59e0b", 2.4, 35, Math.PI / 4, 0.4);
    stageSpot.position.set(0, 16, -2);
    stageSpot.target.position.set(0, 2.5, -7);
    scene.add(stageSpot);
    scene.add(stageSpot.target);

    // ==========================================
    // ARCHITECTURAL CLASSROOM GEOMETRY
    // ==========================================
    // Front Elevated Stage (Natural Light Beech Wood)
    const stageGeo = new THREE.BoxGeometry(28, 0.6, 7.5);
    const stageMat = new THREE.MeshStandardMaterial({
      color: "#e6dcce",
      roughness: 0.35,
      metalness: 0.05,
    });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.position.set(0, 0, -6.8);
    scene.add(stage);

    // Back Acoustic Wall
    const backWallGeo = new THREE.BoxGeometry(32, 10, 0.5);
    const backWallMat = new THREE.MeshStandardMaterial({
      color: "#f5f0e8",
      roughness: 0.65,
      metalness: 0.04,
    });
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.set(0, 5.0, -10.3);
    scene.add(backWall);

    // Architectural Acoustic Wood Slat Panels on Flanks
    const slatMat = new THREE.MeshStandardMaterial({
      color: "#d4a373",
      roughness: 0.35,
      metalness: 0.08,
    });
    for (let s = 0; s < 18; s++) {
      const slatL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 8.5, 0.12), slatMat);
      slatL.position.set(-15.2 + s * 0.32, 4.8, -10.0);
      scene.add(slatL);

      const slatR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 8.5, 0.12), slatMat);
      slatR.position.set(10.0 + s * 0.32, 4.8, -10.0);
      scene.add(slatR);
    }

    // Flanking Slate Chalkboards with Mathematical Formulas
    const leftCanvas = document.createElement("canvas");
    leftCanvas.width = 512;
    leftCanvas.height = 384;
    const rightCanvas = document.createElement("canvas");
    rightCanvas.width = 512;
    rightCanvas.height = 384;

    drawChalkboards(leftCanvas, rightCanvas);

    const leftBoardTexture = new THREE.CanvasTexture(leftCanvas);
    const leftBoardMat = new THREE.MeshBasicMaterial({ map: leftBoardTexture });
    const leftBoard = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 4.2), leftBoardMat);
    leftBoard.position.set(-9.4, 4.4, -9.95);
    scene.add(leftBoard);

    const boardFrameMat = new THREE.MeshStandardMaterial({ color: "#cbbda8", roughness: 0.4 });
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(5.8, 4.4, 0.06), boardFrameMat);
    leftFrame.position.set(-9.4, 4.4, -10.0);
    scene.add(leftFrame);

    const rightBoardTexture = new THREE.CanvasTexture(rightCanvas);
    const rightBoardMat = new THREE.MeshBasicMaterial({ map: rightBoardTexture });
    const rightBoard = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 4.2), rightBoardMat);
    rightBoard.position.set(9.4, 4.4, -9.95);
    scene.add(rightBoard);

    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(5.8, 4.4, 0.06), boardFrameMat);
    rightFrame.position.set(9.4, 4.4, -10.0);
    scene.add(rightFrame);

    // Modern Curved Oak Lectern with Edge Gateway
    const lecternGeo = new THREE.BoxGeometry(1.6, 1.35, 1.0);
    const lecternMat = new THREE.MeshStandardMaterial({
      color: "#d4a373",
      roughness: 0.32,
      metalness: 0.1,
    });
    const lectern = new THREE.Mesh(lecternGeo, lecternMat);
    lectern.position.set(3.8, 0.98, -5.6);
    scene.add(lectern);

    // Professor's Laptop / Edge Gateway Unit
    const edgeLaptopGeo = new THREE.BoxGeometry(0.55, 0.03, 0.38);
    const edgeLaptopMat = new THREE.MeshStandardMaterial({
      color: "#0f172a",
      metalness: 0.85,
      roughness: 0.2,
    });
    const edgeLaptop = new THREE.Mesh(edgeLaptopGeo, edgeLaptopMat);
    edgeLaptop.position.set(3.8, 1.68, -5.5);
    scene.add(edgeLaptop);

    // Professor Laptop Screen glowing cyan
    const edgeScreenGeo = new THREE.PlaneGeometry(0.52, 0.34);
    const edgeScreenMat = new THREE.MeshBasicMaterial({ color: "#38bdf8" });
    const edgeScreen = new THREE.Mesh(edgeScreenGeo, edgeScreenMat);
    edgeScreen.position.set(3.8, 1.86, -5.68);
    edgeScreen.rotation.x = 0.2;
    scene.add(edgeScreen);

    // Edge Gateway Blinking Status Indicator
    const beaconLightGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const beaconLightMat = new THREE.MeshBasicMaterial({ color: "#10b981" });
    const beaconLight = new THREE.Mesh(beaconLightGeo, beaconLightMat);
    beaconLight.position.set(3.8, 1.74, -5.35);
    scene.add(beaconLight);

    // Center Dynamic Projector Screen
    const screenGeo = new THREE.PlaneGeometry(14.0, 6.2);
    const screenCanvas = document.createElement("canvas");
    screenCanvas.width = 1024;
    screenCanvas.height = 512;
    screenCanvasRef.current = screenCanvas;

    const screenTexture = new THREE.CanvasTexture(screenCanvas);
    screenTextureRef.current = screenTexture;
    const screenMat = new THREE.MeshBasicMaterial({
      map: screenTexture,
      toneMapped: false,
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(0, 4.4, -9.8);
    scene.add(screenMesh);

    const screenFrameGeo = new THREE.BoxGeometry(14.3, 6.5, 0.08);
    const screenFrame = new THREE.Mesh(screenFrameGeo, boardFrameMat);
    screenFrame.position.set(0, 4.4, -9.85);
    scene.add(screenFrame);

    // Volumetric Warm Projection Light Cone
    const coneGeo = new THREE.CylinderGeometry(0.35, 7.8, 17, 24, 1, true);
    coneGeo.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: "#f59e0b",
      transparent: true,
      opacity: 0.035,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const projectorBeam = new THREE.Mesh(coneGeo, coneMat);
    projectorBeam.position.set(0, 7.8, 0);
    projectorBeam.lookAt(0, 4.4, -9.8);
    scene.add(projectorBeam);

    // ==========================================
    // 12 TIERED RISERS & CONTINUOUS OAK DESKS
    // ==========================================
    const riserMat = new THREE.MeshStandardMaterial({
      color: "#f8fafc",
      roughness: 0.65,
      metalness: 0.04,
    });
    const deskMat = new THREE.MeshStandardMaterial({
      color: "#d4a373",
      roughness: 0.35,
      metalness: 0.08,
    });
    const stanchionMat = new THREE.MeshStandardMaterial({
      color: "#1e293b",
      roughness: 0.45,
      metalness: 0.7,
    });

    for (let r = 0; r < 12; r++) {
      const tierElevation = 0.35 + r * 0.45;
      const tierZ = -3.2 + r * 1.55;

      // Solid Step Tread Platform (Horizontal amphitheater tier floor)
      const treadGeo = new THREE.BoxGeometry(30, 0.14, 1.55);
      const tread = new THREE.Mesh(treadGeo, riserMat);
      tread.position.set(0, tierElevation - 0.07, tierZ);
      scene.add(tread);

      // Vertical Step Riser Face (facing forward towards the front board)
      const riserFaceGeo = new THREE.BoxGeometry(30, 0.45, 0.08);
      const riserFace = new THREE.Mesh(riserFaceGeo, riserMat);
      riserFace.position.set(0, tierElevation - 0.225, tierZ - 0.77);
      scene.add(riserFace);

      // Continuous Oak Wood Desk with satin finish
      const deskGeo = new THREE.BoxGeometry(28.5, 0.08, 0.48);
      const desk = new THREE.Mesh(deskGeo, deskMat);
      desk.position.set(0, tierElevation + 0.65, tierZ - 0.50);
      scene.add(desk);

      // Metal Desk Support Stanchions
      for (let s = -4; s <= 4; s++) {
        const stanchion = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 8), stanchionMat);
        stanchion.position.set(s * 3.2, tierElevation + 0.325, tierZ - 0.50);
        scene.add(stanchion);
      }

      // Warm Step Edge Tread Lighting (Real architectural LED strip)
      const stepLightGeo = new THREE.BoxGeometry(28.5, 0.025, 0.025);
      const stepLightMat = new THREE.MeshBasicMaterial({
        color: "#f59e0b",
        transparent: true,
        opacity: 0.35,
      });
      const stepLight = new THREE.Mesh(stepLightGeo, stepLightMat);
      stepLight.position.set(0, tierElevation - 0.02, tierZ - 0.78);
      scene.add(stepLight);

      // Intermediate Aisle Stair Steps for the 2 Walkways (x = -4.85, x = +4.85)
      [-4.85, 4.85].forEach((aisleX) => {
        const aisleStepGeo = new THREE.BoxGeometry(1.15, 0.22, 0.55);
        const aisleStep = new THREE.Mesh(aisleStepGeo, riserMat);
        aisleStep.position.set(aisleX, tierElevation - 0.34, tierZ - 0.77);
        scene.add(aisleStep);

        const aisleStepLight = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 0.02, 0.02),
          new THREE.MeshBasicMaterial({ color: "#fbbf24", transparent: true, opacity: 0.45 })
        );
        aisleStepLight.position.set(aisleX, tierElevation - 0.23, tierZ - 0.76);
        scene.add(aisleStepLight);
      });
    }

    // Front Row Privacy Modesty Panel (Front of Tier 1 facing stage)
    const modestyPanelMat = new THREE.MeshStandardMaterial({
      color: "#d4a373",
      roughness: 0.35,
      metalness: 0.08,
    });
    const modestyPanel = new THREE.Mesh(new THREE.BoxGeometry(28.5, 0.60, 0.05), modestyPanelMat);
    modestyPanel.position.set(0, 0.35 + 0.30, -3.2 - 0.76);
    scene.add(modestyPanel);

    // Overhead Ceiling Trusses & Linear Lights
    const trussMat = new THREE.MeshStandardMaterial({
      color: "#e2e8f0",
      roughness: 0.7,
    });
    const ceilingLightMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });

    for (let t = 0; t < 5; t++) {
      const trussGeo = new THREE.BoxGeometry(32, 0.8, 0.4);
      const truss = new THREE.Mesh(trussGeo, trussMat);
      truss.position.set(0, 11.5, -6 + t * 5);
      scene.add(truss);

      const fixture = new THREE.Mesh(new THREE.BoxGeometry(24, 0.04, 0.12), ceilingLightMat);
      fixture.position.set(0, 11.08, -6 + t * 5);
      scene.add(fixture);
    }

    // Overhead Wireless Access Point
    const apGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16);
    const apMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.2 });
    const ap = new THREE.Mesh(apGeo, apMat);
    ap.position.set(0, 11.0, 4.0);
    scene.add(ap);

    // ==========================================
    // 240 INSTANCED AUDITORIUM SEATS & LIVING STUDENTS
    // ==========================================
    const totalCount = seatsData.current.length;
    const dummy = new THREE.Object3D();

    // 1. Instanced Chair Seat Cushions
    const seatCushionGeo = new THREE.BoxGeometry(0.56, 0.10, 0.46);
    const chairMat = new THREE.MeshStandardMaterial({
      roughness: 0.4,
      metalness: 0.15,
    });
    const instancedSeats = new THREE.InstancedMesh(seatCushionGeo, chairMat, totalCount);
    instancedSeats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // 2. Instanced Chair Backrests
    const backrestGeo = new THREE.BoxGeometry(0.56, 0.52, 0.10);
    const backrestMat = new THREE.MeshStandardMaterial({
      color: "#334155",
      roughness: 0.5,
      metalness: 0.1,
    });
    const instancedBackrests = new THREE.InstancedMesh(backrestGeo, backrestMat, totalCount);
    instancedBackrests.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    seatsData.current.forEach((seat, idx) => {
      const isUnrecorded = seat.targetStatus === "unrecorded";

      dummy.position.set(
        seat.x,
        isUnrecorded ? seat.y + 0.28 : seat.y + 0.12,
        isUnrecorded ? seat.z - 0.12 : seat.z
      );
      dummy.rotation.set(isUnrecorded ? -Math.PI / 2.3 : 0, -seat.x * 0.03, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      instancedSeats.setMatrixAt(idx, dummy.matrix);
      instancedSeats.setColorAt(idx, new THREE.Color("#64748b"));

      dummy.position.set(seat.x, seat.y + 0.38, seat.z + 0.20);
      dummy.rotation.set(-0.06, -seat.x * 0.03, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      instancedBackrests.setMatrixAt(idx, dummy.matrix);
    });
    instancedSeats.instanceMatrix.needsUpdate = true;
    if (instancedSeats.instanceColor) instancedSeats.instanceColor.needsUpdate = true;
    instancedBackrests.instanceMatrix.needsUpdate = true;
    scene.add(instancedSeats);
    scene.add(instancedBackrests);
    instancedSeatsRef.current = instancedSeats;
    instancedBackrestsRef.current = instancedBackrests;

    // 3. Instanced Student Bodies
    const torsoGeo = new THREE.BoxGeometry(0.44, 0.48, 0.28);
    const torsoMat = new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0.05,
    });
    const instancedTorsos = new THREE.InstancedMesh(torsoGeo, torsoMat, totalCount);
    instancedTorsos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // 4. Instanced Student Heads
    const headGeo = new THREE.SphereGeometry(0.14, 16, 12);
    const headMat = new THREE.MeshStandardMaterial({
      roughness: 0.45,
      metalness: 0.05,
    });
    const instancedHeads = new THREE.InstancedMesh(headGeo, headMat, totalCount);
    instancedHeads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    seatsData.current.forEach((seat, idx) => {
      const isUnrecorded = seat.targetStatus === "unrecorded";

      if (!isUnrecorded) {
        dummy.position.set(seat.x, seat.y + 0.42, seat.z - 0.06);
        dummy.rotation.set(0.08, -seat.x * 0.03, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instancedTorsos.setMatrixAt(idx, dummy.matrix);
        instancedTorsos.setColorAt(idx, seat.bodyColor);

        dummy.position.set(seat.x, seat.y + 0.78, seat.z - 0.06);
        dummy.rotation.set(0.06, -seat.x * 0.03, 0);
        dummy.scale.set(1, 1.05, 1);
        dummy.updateMatrix();
        instancedHeads.setMatrixAt(idx, dummy.matrix);
        instancedHeads.setColorAt(idx, seat.headColor);
      } else {
        dummy.scale.set(0.0001, 0.0001, 0.0001);
        dummy.updateMatrix();
        instancedTorsos.setMatrixAt(idx, dummy.matrix);
        instancedHeads.setMatrixAt(idx, dummy.matrix);
      }
    });
    instancedTorsos.instanceMatrix.needsUpdate = true;
    if (instancedTorsos.instanceColor) instancedTorsos.instanceColor.needsUpdate = true;
    instancedHeads.instanceMatrix.needsUpdate = true;
    if (instancedHeads.instanceColor) instancedHeads.instanceColor.needsUpdate = true;
    scene.add(instancedTorsos);
    scene.add(instancedHeads);
    instancedTorsosRef.current = instancedTorsos;
    instancedHeadsRef.current = instancedHeads;

    // 5. Instanced Student Laptops on Desks
    const laptopBaseGeo = new THREE.BoxGeometry(0.34, 0.015, 0.24);
    const laptopMat = new THREE.MeshStandardMaterial({
      color: "#1e293b",
      metalness: 0.8,
      roughness: 0.2,
    });
    const instancedLaptops = new THREE.InstancedMesh(laptopBaseGeo, laptopMat, totalCount);
    instancedLaptops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const laptopScreenGeo = new THREE.PlaneGeometry(0.32, 0.20);
    const laptopScreenMat = new THREE.MeshBasicMaterial({
      color: "#e2e8f0",
      side: THREE.DoubleSide,
    });
    const instancedLaptopScreens = new THREE.InstancedMesh(laptopScreenGeo, laptopScreenMat, totalCount);
    instancedLaptopScreens.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    seatsData.current.forEach((seat, idx) => {
      if (seat.hasLaptop) {
        dummy.position.set(seat.x - 0.08, seat.y + 0.36, seat.z - 0.44);
        dummy.rotation.set(0, -seat.x * 0.03 + (idx % 2 === 0 ? 0.05 : -0.05), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instancedLaptops.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(seat.x - 0.08, seat.y + 0.46, seat.z - 0.54);
        dummy.rotation.set(-0.25, -seat.x * 0.03 + (idx % 2 === 0 ? 0.05 : -0.05), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instancedLaptopScreens.setMatrixAt(idx, dummy.matrix);
      } else {
        dummy.scale.set(0.0001, 0.0001, 0.0001);
        dummy.updateMatrix();
        instancedLaptops.setMatrixAt(idx, dummy.matrix);
        instancedLaptopScreens.setMatrixAt(idx, dummy.matrix);
      }
    });
    instancedLaptops.instanceMatrix.needsUpdate = true;
    instancedLaptopScreens.instanceMatrix.needsUpdate = true;
    scene.add(instancedLaptops);
    scene.add(instancedLaptopScreens);
    instancedLaptopsRef.current = instancedLaptops;
    instancedLaptopScreensRef.current = instancedLaptopScreens;

    // 6. Instanced Student Smartphones
    const phoneGeo = new THREE.BoxGeometry(0.11, 0.018, 0.20);
    const phoneMat = new THREE.MeshStandardMaterial({
      color: "#0f172a",
      metalness: 0.85,
      roughness: 0.15,
    });
    const instancedPhones = new THREE.InstancedMesh(phoneGeo, phoneMat, totalCount);
    instancedPhones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const screenPieceGeo = new THREE.BoxGeometry(0.095, 0.005, 0.175);
    const screenPieceMat = new THREE.MeshBasicMaterial({ color: "#64748b" });
    const instancedScreens = new THREE.InstancedMesh(screenPieceGeo, screenPieceMat, totalCount);
    instancedScreens.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    seatsData.current.forEach((seat, idx) => {
      const isUnrecorded = seat.targetStatus === "unrecorded";
      if (!isUnrecorded) {
        dummy.position.set(seat.x + 0.14, seat.y + 0.36, seat.z - 0.40);
        dummy.rotation.set(0, -seat.x * 0.03, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instancedPhones.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(seat.x + 0.14, seat.y + 0.37, seat.z - 0.40);
        dummy.updateMatrix();
        instancedScreens.setMatrixAt(idx, dummy.matrix);
        instancedScreens.setColorAt(idx, new THREE.Color("#475569"));
      } else {
        dummy.scale.set(0.0001, 0.0001, 0.0001);
        dummy.updateMatrix();
        instancedPhones.setMatrixAt(idx, dummy.matrix);
        instancedScreens.setMatrixAt(idx, dummy.matrix);
      }
    });
    instancedPhones.instanceMatrix.needsUpdate = true;
    instancedScreens.instanceMatrix.needsUpdate = true;
    if (instancedScreens.instanceColor) instancedScreens.instanceColor.needsUpdate = true;
    scene.add(instancedPhones);
    scene.add(instancedScreens);
    instancedPhonesRef.current = instancedPhones;
    instancedScreensRef.current = instancedScreens;

    // 7. Instanced Holographic Verification Halo Rings
    const haloGeo = new THREE.TorusGeometry(0.24, 0.022, 10, 28);
    const haloMat = new THREE.MeshBasicMaterial({
      color: "#10b981",
      transparent: true,
      opacity: 0.9,
    });
    const instancedHalos = new THREE.InstancedMesh(haloGeo, haloMat, totalCount);
    instancedHalos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    seatsData.current.forEach((seat, idx) => {
      dummy.position.set(seat.x, seat.y + 1.15, seat.z - 0.06);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.scale.set(0.0001, 0.0001, 0.0001);
      dummy.updateMatrix();
      instancedHalos.setMatrixAt(idx, dummy.matrix);
      instancedHalos.setColorAt(idx, new THREE.Color("#10b981"));
    });
    instancedHalos.instanceMatrix.needsUpdate = true;
    if (instancedHalos.instanceColor) instancedHalos.instanceColor.needsUpdate = true;
    scene.add(instancedHalos);
    instancedHalosRef.current = instancedHalos;

    // ==========================================
    // FEATURED CLOSE-UP STUDENT (#28) HIGHLIGHTS
    // ==========================================
    const alexSeat = seatsData.current.find((s) => s.id === 28);
    if (alexSeat) {
      const featPhoneGeo = new THREE.BoxGeometry(0.14, 0.022, 0.25);
      const featPhoneMat = new THREE.MeshStandardMaterial({
        color: "#0f172a",
        metalness: 0.9,
        roughness: 0.15,
      });
      const featPhone = new THREE.Mesh(featPhoneGeo, featPhoneMat);
      featPhone.position.set(alexSeat.x, alexSeat.y + 0.62, alexSeat.z - 0.38);
      featPhone.rotation.set(0.48, -0.08, 0);
      scene.add(featPhone);
      featuredPhoneRef.current = featPhone;

      const laserGeo = new THREE.ConeGeometry(0.35, 1.2, 4, 1, true);
      laserGeo.rotateX(Math.PI);
      const laserMat = new THREE.MeshBasicMaterial({
        color: "#10b981",
        transparent: true,
        opacity: 0.25,
        wireframe: true,
        side: THREE.DoubleSide,
      });
      const laser = new THREE.Mesh(laserGeo, laserMat);
      laser.position.set(alexSeat.x, alexSeat.y + 0.75, alexSeat.z - 0.45);
      laser.lookAt(0, 4.4, -9.8);
      scene.add(laser);
      featuredLaserRef.current = laser;

      const checkmarkGroup = new THREE.Group();
      const checkCircleGeo = new THREE.TorusGeometry(0.18, 0.02, 12, 24);
      const checkCircleMat = new THREE.MeshBasicMaterial({ color: "#10b981" });
      const checkCircle = new THREE.Mesh(checkCircleGeo, checkCircleMat);
      checkmarkGroup.add(checkCircle);

      const arm1Geo = new THREE.BoxGeometry(0.04, 0.10, 0.03);
      const armMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
      const arm1 = new THREE.Mesh(arm1Geo, armMat);
      arm1.position.set(-0.04, -0.02, 0);
      arm1.rotation.set(0, 0, -Math.PI / 4);
      checkmarkGroup.add(arm1);

      const arm2Geo = new THREE.BoxGeometry(0.04, 0.18, 0.03);
      const arm2 = new THREE.Mesh(arm2Geo, armMat);
      arm2.position.set(0.05, 0.02, 0);
      arm2.rotation.set(0, 0, Math.PI / 4);
      checkmarkGroup.add(arm2);

      checkmarkGroup.position.set(alexSeat.x, alexSeat.y + 1.25, alexSeat.z - 0.06);
      checkmarkGroup.scale.set(0.0001, 0.0001, 0.0001);
      scene.add(checkmarkGroup);
      featuredCheckmarkRef.current = checkmarkGroup;
    }

    // ==========================================
    // DATA NETWORK TRANSMISSION BEAMS
    // ==========================================
    const beamLines: number[] = [];
    for (let i = 0; i < seatsData.current.length; i += 8) {
      const seat = seatsData.current[i];
      const p0 = new THREE.Vector3(seat.x, seat.y + 0.5, seat.z - 0.3);
      const p1 = new THREE.Vector3((seat.x + 3.8) * 0.5, seat.y + 3.0, (seat.z - 5.6) * 0.5);
      const p2 = new THREE.Vector3(3.8, 1.6, -5.5);

      const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
      const points = curve.getPoints(12);
      for (let j = 0; j < points.length - 1; j++) {
        beamLines.push(
          points[j].x, points[j].y, points[j].z,
          points[j + 1].x, points[j + 1].y, points[j + 1].z
        );
      }
    }

    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute("position", new THREE.Float32BufferAttribute(beamLines, 3));
    const beamMat = new THREE.LineBasicMaterial({
      color: "#10b981",
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
    });
    const dataBeams = new THREE.LineSegments(beamGeo, beamMat);
    scene.add(dataBeams);
    dataBeamsRef.current = dataBeams;

    // Mouse Parallax listener
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mousePos.current = { x, y };
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Click raycasting to inspect 3D seats
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    const handleClick = (e: MouseEvent) => {
      if (!cameraRef.current || !instancedSeatsRef.current) return;
      const rect = container.getBoundingClientRect();
      mouseVector.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVector.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      raycaster.setFromCamera(mouseVector, cameraRef.current);
      const intersects = raycaster.intersectObject(instancedSeatsRef.current);

      if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
        const id = intersects[0].instanceId;
        const seat = seatsData.current[id];
        if (seat) {
          soundManager.playClick();
          setHoveredSeat(seat);
        }
      }
    };
    container.addEventListener("click", handleClick);

    // Resize listener
    const handleResize = () => {
      if (!rendererRef.current || !cameraRef.current) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // ==========================================
    // PERSISTENT 60 FPS ANIMATION LOOP
    // ==========================================
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const verifiedEmerald = new THREE.Color("#10b981");
    const verifiedAmber = new THREE.Color("#f59e0b");
    const pendingMarigold = new THREE.Color("#eab308");
    const unrecordedSlate = new THREE.Color("#94a3b8");
    const dimmedSlate = new THREE.Color("#e2e8f0");
    const scanningCyan = new THREE.Color("#38bdf8");

    let lastCanvUpdate = 0;
    const dummyObject = new THREE.Object3D();
    const tempColor = new THREE.Color();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(0.1, clock.getDelta());
      const elapsed = clock.getElapsedTime();

      // Read current dynamic values from refs (continuous, ZERO SNAP!)
      const targetP = scrollProgressRef.current;
      const curCohort = selectedCohortRef.current;
      const curZone = activeZoneRef.current;

      // CONTINUOUS CAMERA TRACKER - continues from exact phase:
      currentSmoothProgress.current +=
        (targetP - currentSmoothProgress.current) * Math.min(1, delta * 4.8);

      const smoothP = currentSmoothProgress.current;
      const traj = getCameraTrajectory(smoothP);

      // Camera flight position & lookAt with subtle mouse parallax
      if (cameraRef.current) {
        const cam = cameraRef.current;
        const targetX = traj.pos.x + mousePos.current.x * 0.45;
        const targetY = traj.pos.y + mousePos.current.y * 0.25;
        const targetZ = traj.pos.z;

        cam.position.x += (targetX - cam.position.x) * Math.min(1, delta * 4.5);
        cam.position.y += (targetY - cam.position.y) * Math.min(1, delta * 4.5);
        cam.position.z += (targetZ - cam.position.z) * Math.min(1, delta * 4.5);

        currentLookAt.current.x += (traj.look.x - currentLookAt.current.x) * Math.min(1, delta * 4.8);
        currentLookAt.current.y += (traj.look.y - currentLookAt.current.y) * Math.min(1, delta * 4.8);
        currentLookAt.current.z += (traj.look.z - currentLookAt.current.z) * Math.min(1, delta * 4.8);

        cam.lookAt(currentLookAt.current);

        if (Math.abs(cam.fov - traj.fov) > 0.05) {
          cam.fov += (traj.fov - cam.fov) * Math.min(1, delta * 3.5);
          cam.updateProjectionMatrix();
        }
      }

      setCurrentVantageName(traj.name);

      if (projectorBeam) {
        coneMat.opacity = 0.035 + Math.sin(elapsed * 2.4) * 0.015;
      }

      if (beaconLightMat) {
        beaconLightMat.color.set(Math.sin(elapsed * 6.0) > 0 ? "#10b981" : "#059669");
      }

      let currentVerifiedCount = 0;
      const seatsMesh = instancedSeatsRef.current;
      const torsosMesh = instancedTorsosRef.current;
      const headsMesh = instancedHeadsRef.current;
      const phonesMesh = instancedPhonesRef.current;
      const screensMesh = instancedScreensRef.current;
      const halosMesh = instancedHalosRef.current;

      seatsData.current.forEach((seat, idx) => {
        const inCohort =
          curCohort === 80
            ? seat.id <= 80
            : curCohort === 120
              ? seat.id <= 120
              : true;

        const inZone = curZone === "all" || seat.zone === curZone;
        const isDimmed = !inCohort || !inZone;

        const isMarked = smoothP >= seat.activationScroll;
        const markDelta = smoothP - seat.activationScroll;

        if (isMarked && seat.targetStatus === "verified" && !isDimmed) {
          currentVerifiedCount++;
        }

        if (seatsMesh && seatsMesh.instanceColor) {
          if (isDimmed) {
            tempColor.copy(dimmedSlate);
          } else if (isMarked) {
            if (seat.targetStatus === "verified") {
              tempColor.copy(seat.id % 2 === 0 ? verifiedAmber : verifiedEmerald);
            } else if (seat.targetStatus === "pending") {
              tempColor.copy(pendingMarigold);
            } else {
              tempColor.copy(unrecordedSlate);
            }
          } else {
            tempColor.copy(dimmedSlate);
          }
          seatsMesh.setColorAt(idx, tempColor);
        }

        if (torsosMesh && headsMesh && seat.targetStatus !== "unrecorded") {
          const breathY = Math.sin(elapsed * 2.2 + idx * 0.35) * 0.012;
          const glanceY = Math.sin(elapsed * 0.8 + idx * 0.6) * 0.04;

          dummyObject.position.set(seat.x, seat.y + 0.42 + breathY, seat.z - 0.06);
          dummyObject.rotation.set(0.08, -seat.x * 0.03, 0);
          dummyObject.scale.set(1, 1 + breathY * 0.5, 1);
          dummyObject.updateMatrix();
          torsosMesh.setMatrixAt(idx, dummyObject.matrix);

          dummyObject.position.set(seat.x, seat.y + 0.78 + breathY, seat.z - 0.06);
          dummyObject.rotation.set(0.06, -seat.x * 0.03 + glanceY, 0);
          dummyObject.scale.set(1, 1.05, 1);
          dummyObject.updateMatrix();
          headsMesh.setMatrixAt(idx, dummyObject.matrix);
        }

        if (phonesMesh && screensMesh && screensMesh.instanceColor && seat.targetStatus !== "unrecorded") {
          const isScanningNow = isMarked && markDelta < 0.06;

          if (isScanningNow) {
            dummyObject.position.set(seat.x + 0.02, seat.y + 0.65, seat.z - 0.36);
            dummyObject.rotation.set(0.42, -seat.x * 0.03, 0);
            screensMesh.setColorAt(idx, scanningCyan);
          } else if (isMarked) {
            dummyObject.position.set(seat.x + 0.14, seat.y + 0.36, seat.z - 0.40);
            dummyObject.rotation.set(0, -seat.x * 0.03, 0);
            if (seat.targetStatus === "verified") {
              screensMesh.setColorAt(idx, verifiedEmerald);
            } else if (seat.targetStatus === "pending") {
              screensMesh.setColorAt(idx, pendingMarigold);
            } else {
              screensMesh.setColorAt(idx, unrecordedSlate);
            }
          } else {
            dummyObject.position.set(seat.x + 0.14, seat.y + 0.36, seat.z - 0.40);
            dummyObject.rotation.set(0, -seat.x * 0.03, 0);
            screensMesh.setColorAt(idx, dimmedSlate);
          }

          dummyObject.scale.set(1, 1, 1);
          dummyObject.updateMatrix();
          phonesMesh.setMatrixAt(idx, dummyObject.matrix);

          dummyObject.position.y += 0.01;
          dummyObject.updateMatrix();
          screensMesh.setMatrixAt(idx, dummyObject.matrix);
        }

        if (halosMesh) {
          if (isMarked && !isDimmed && seat.targetStatus !== "unrecorded") {
            const progress = Math.min(1, markDelta * 14);
            const scale = progress < 0.7
              ? (progress / 0.7) * 1.3
              : 1.3 - ((progress - 0.7) / 0.3) * 0.3;

            const hoverOffset = Math.sin(elapsed * 3.0 + idx * 0.3) * 0.04;

            dummyObject.position.set(seat.x, seat.y + 1.15 + hoverOffset, seat.z - 0.06);
            dummyObject.rotation.set(Math.PI / 2, 0, elapsed * 1.5 + idx);
            dummyObject.scale.set(scale, scale, scale);
            dummyObject.updateMatrix();
            halosMesh.setMatrixAt(idx, dummyObject.matrix);

            if (halosMesh.instanceColor) {
              halosMesh.setColorAt(
                idx,
                seat.targetStatus === "verified" ? verifiedEmerald : pendingMarigold
              );
            }
          } else {
            dummyObject.scale.set(0.0001, 0.0001, 0.0001);
            dummyObject.updateMatrix();
            halosMesh.setMatrixAt(idx, dummyObject.matrix);
          }
        }
      });

      if (seatsMesh && seatsMesh.instanceColor) seatsMesh.instanceColor.needsUpdate = true;
      if (torsosMesh) torsosMesh.instanceMatrix.needsUpdate = true;
      if (headsMesh) headsMesh.instanceMatrix.needsUpdate = true;
      if (phonesMesh) phonesMesh.instanceMatrix.needsUpdate = true;
      if (screensMesh) {
        screensMesh.instanceMatrix.needsUpdate = true;
        if (screensMesh.instanceColor) screensMesh.instanceColor.needsUpdate = true;
      }
      if (halosMesh) {
        halosMesh.instanceMatrix.needsUpdate = true;
        if (halosMesh.instanceColor) halosMesh.instanceColor.needsUpdate = true;
      }

      if (featuredLaserRef.current && featuredCheckmarkRef.current) {
        const alexMarked = smoothP >= 0.42;
        const alexLaser = featuredLaserRef.current;
        const alexCheck = featuredCheckmarkRef.current;

        if (smoothP >= 0.38 && smoothP <= 0.58) {
          alexLaser.visible = true;
          (alexLaser.material as THREE.MeshBasicMaterial).opacity =
            0.15 + Math.sin(elapsed * 12.0) * 0.12;

          if (alexMarked) {
            const checkScale = Math.min(1.0, (smoothP - 0.42) * 20);
            alexCheck.scale.set(checkScale, checkScale, checkScale);
            alexCheck.rotation.y = elapsed * 1.8;
            alexCheck.position.y = (alexSeat?.y || 0) + 1.25 + Math.sin(elapsed * 3) * 0.03;
          } else {
            alexCheck.scale.set(0.0001, 0.0001, 0.0001);
          }
        } else {
          alexLaser.visible = false;
          alexCheck.scale.set(0.0001, 0.0001, 0.0001);
        }
      }

      if (dataBeamsRef.current) {
        (dataBeamsRef.current.material as THREE.LineBasicMaterial).opacity =
          smoothP > 0.5 ? 0.18 + Math.sin(elapsed * 4.0) * 0.08 : 0.03;
      }

      if (elapsed - lastCanvUpdate > 0.08) {
        lastCanvUpdate = elapsed;
        updateProjectorCanvas(currentVerifiedCount, elapsed, smoothP);

        if (currentVerifiedCount !== lastVerifiedCountRef.current) {
          lastVerifiedCountRef.current = currentVerifiedCount;
          setLiveVerifiedCount(currentVerifiedCount);
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("click", handleClick);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, []); // Strictly runs ONCE on mount! NEVER re-created!

  // Jump camera smoothly to specific vantage point
  const jumpToVantage = (targetP: number) => {
    soundManager.playClick();
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({
      top: targetP * totalHeight,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden">
      {/* 3D WebGL Canvas - ALWAYS ACTIVE AND MOUNTED */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating Cinematic 3D Camera Vantage HUD */}
      <div className="absolute top-4 inset-x-4 sm:inset-x-8 z-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pointer-events-none">
        {/* Active Camera View Pill */}
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 backdrop-blur-md border border-slate-300/80 shadow-lg text-slate-800 pointer-events-auto">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600"></span>
          </span>
          <span className="font-mono text-[10px] font-bold text-amber-950 tracking-wider">
            {currentVantageName}
          </span>
          <span className="text-slate-400 text-xs font-bold">|</span>
          <span className="hidden md:inline text-[9px] font-mono text-slate-700 font-bold">
            ROOM A-101 • WI-FI 6E ACTIVE
          </span>
        </div>

        {/* Quick Camera Flight Jump Shortcuts */}
        <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-full bg-white/95 backdrop-blur-md border border-slate-300/80 shadow-lg pointer-events-auto">
          <span className="px-2.5 text-[9px] font-mono text-slate-700 font-bold tracking-wider">
            FLY CAM:
          </span>
          <button
            onClick={() => jumpToVantage(0.00)}
            className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold transition-all cursor-pointer ${
              scrollProgress < 0.12
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-800 hover:bg-slate-100"
            }`}
          >
            Stage
          </button>
          <button
            onClick={() => jumpToVantage(0.16)}
            className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold transition-all cursor-pointer ${
              scrollProgress >= 0.12 && scrollProgress < 0.28
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-800 hover:bg-slate-100"
            }`}
          >
            Low Desk
          </button>
          <button
            onClick={() => jumpToVantage(0.46)}
            className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
              scrollProgress >= 0.35 && scrollProgress < 0.55
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-800 hover:bg-slate-100"
            }`}
          >
            <Smartphone className="w-2.5 h-2.5 text-amber-700" />
            Student POV
          </button>
          <button
            onClick={() => jumpToVantage(0.60)}
            className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold transition-all cursor-pointer ${
              scrollProgress >= 0.55 && scrollProgress < 0.70
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-800 hover:bg-slate-100"
            }`}
          >
            Cohort 80
          </button>
          <button
            onClick={() => jumpToVantage(0.74)}
            className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold transition-all cursor-pointer ${
              scrollProgress >= 0.70 && scrollProgress < 0.82
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-800 hover:bg-slate-100"
            }`}
          >
            Cohort 120
          </button>
          <button
            onClick={() => jumpToVantage(0.86)}
            className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold transition-all cursor-pointer ${
              scrollProgress >= 0.82
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-800 hover:bg-slate-100"
            }`}
          >
            Balcony 240
          </button>
        </div>

        {/* 2D / 3D Seating Chart Overlay Trigger */}
        <div className="pointer-events-auto">
          <button
            onClick={() => {
              soundManager.playClick();
              setShow2DOverlay(!show2DOverlay);
            }}
            className="px-3.5 py-1.5 rounded-full text-xs font-mono bg-white/95 backdrop-blur-md text-slate-800 hover:text-slate-950 border border-slate-300 hover:border-amber-500 transition-colors flex items-center gap-1.5 shadow-md cursor-pointer font-bold"
            title="Toggle 2D Seating Chart Overlay"
          >
            <Layers className="w-3.5 h-3.5 text-amber-700" />
            <span>{show2DOverlay ? "Hide Floor Plan" : "2D Seating Plan"}</span>
          </button>
        </div>
      </div>

      {/* Floating 2D Seating Chart Modal (Never replaces WebGL!) */}
      {show2DOverlay && (
        <div className="absolute inset-4 sm:inset-12 z-30 bg-white/95 backdrop-blur-xl p-6 rounded-3xl border border-slate-300 shadow-2xl flex flex-col items-center justify-between animate-in fade-in zoom-in-95 overflow-hidden">
          <div className="w-full flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span className="text-xs uppercase tracking-widest text-amber-800 font-mono font-bold">
                Classroom Floor Plan & Topology Matrix
              </span>
              <p className="text-xs text-slate-700 font-medium">
                Tiered 240-seat amphitheater seating topology (CS-401 Lecture Hall A)
              </p>
            </div>
            <button
              onClick={() => setShow2DOverlay(false)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-sm font-mono cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="w-full my-auto overflow-x-auto py-4 flex flex-col items-center">
            <div className="w-3/4 max-w-xl mx-auto mb-4 py-2 px-4 rounded-lg bg-amber-50 border border-amber-300 text-center text-xs font-mono text-amber-950 font-bold">
              [ FRONT PODIUM & CLASSROOM CONTEXT • ILLUSTRATIVE SCENE ]
            </div>
            <div className="flex flex-col gap-1.5 items-center">
              {Array.from({ length: 12 }).map((_, r) => {
                const rowSeats = seatsData.current.filter((s) => s.row === r + 1);
                return (
                  <div key={r} className="flex items-center gap-1">
                    <span className="w-6 text-[10px] font-mono text-slate-700 text-right pr-1 font-bold">
                      R{r + 1}
                    </span>
                    {rowSeats.map((seat) => {
                      const isMarked = scrollProgress >= seat.activationScroll;
                      let bgClass = "bg-slate-200 border border-slate-300";
                      if (isMarked) {
                        if (seat.targetStatus === "verified") bgClass = "bg-emerald-500 shadow-[0_0_6px_#10b981]";
                        else if (seat.targetStatus === "pending") bgClass = "bg-amber-500 shadow-[0_0_6px_#f59e0b]";
                        else bgClass = "bg-slate-400";
                      }

                      return (
                        <button
                          key={seat.id}
                          onClick={() => {
                            soundManager.playClick();
                            setHoveredSeat(seat);
                            setShow2DOverlay(false);
                          }}
                          title={`Seat #${seat.id}: ${seat.name} - ${seat.targetStatus}`}
                          className={`w-3.5 h-3.5 rounded-sm transition-transform hover:scale-125 ${bgClass} ${
                            seat.col === 5 || seat.col === 15 ? "mr-2.5" : ""
                          }`}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-700 text-center font-semibold">
            Click any seat to inspect student biometric verification telemetry in 3D.
          </div>
        </div>
      )}

      {/* Interactive Student Seat Telemetry Card if Clicked */}
      {hoveredSeat && (
        <div className="absolute top-20 right-4 sm:right-8 z-30 max-w-sm w-full bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-300 shadow-2xl text-xs text-slate-850 transition-all animate-in fade-in zoom-in-95">
          <div className="flex items-start justify-between border-b border-slate-200 pb-2.5 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-950 border border-amber-300 flex items-center justify-center font-bold text-xs">
                {hoveredSeat.id}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm leading-tight">{hoveredSeat.name}</h4>
                <span className="text-[10px] font-mono text-slate-700 font-semibold">{hoveredSeat.studentId}</span>
              </div>
            </div>
            <button
              onClick={() => setHoveredSeat(null)}
              className="text-slate-500 hover:text-slate-900 text-lg px-1.5 leading-none cursor-pointer"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-3">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-700 block text-[10px] font-bold">LOCATION:</span>
              <span className="font-extrabold text-slate-900">
                Tier R{hoveredSeat.row}, Seat {hoveredSeat.col}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-700 block text-[10px] font-bold">ZONE:</span>
              <span className="font-extrabold text-slate-900 uppercase">{hoveredSeat.zone}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-700 block text-[10px] font-bold">ARCFACE COSINE:</span>
              <span className="font-extrabold text-emerald-800">{hoveredSeat.confidence}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-700 block text-[10px] font-bold">VERIFIED AT:</span>
              <span className="font-extrabold text-slate-900">{hoveredSeat.scanTime}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-[10px]">
            <span className="text-slate-700 font-bold">Target Session Status:</span>
            <span
              className={`px-2 py-0.5 rounded font-mono font-bold uppercase ${
                hoveredSeat.targetStatus === "verified"
                  ? "bg-emerald-100 text-emerald-950 border border-emerald-300"
                  : hoveredSeat.targetStatus === "pending"
                    ? "bg-amber-100 text-amber-950 border border-amber-300"
                    : "bg-slate-200 text-slate-800"
              }`}
            >
              {hoveredSeat.targetStatus}
            </span>
          </div>
        </div>
      )}

      {/* Live Bottom Attendance HUD (Synced with 3D Hall Attendance Marking Wave) */}
      <div className="absolute bottom-4 inset-x-4 sm:inset-x-8 z-10 pointer-events-none flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-300/80 text-xs font-mono flex items-center gap-3 shadow-lg pointer-events-auto">
          <div className="flex items-center gap-1.5 text-emerald-900 font-extrabold">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>{liveVerifiedCount} / 240 MARKED</span>
          </div>
          <span className="text-slate-400 font-bold">|</span>
          <div className="w-24 sm:w-36 h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-300"
              style={{ width: `${(liveVerifiedCount / 240) * 100}%` }}
            />
          </div>
          <span className="text-slate-800 font-extrabold text-[11px]">
            {((liveVerifiedCount / 240) * 100).toFixed(0)}%
          </span>
          <span className="text-slate-400 font-bold hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center gap-2 text-[10px]">
            <span className="text-amber-900 font-extrabold">12 Pending</span>
            <span className="text-slate-400 font-bold">•</span>
            <span className="text-slate-700 font-bold">10 Unrecorded</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-slate-300 text-[10px] font-mono text-slate-800 font-bold shadow-md">
          <Compass className="w-3.5 h-3.5 text-amber-700" />
          <span>SCROLL PROGRESS: {Math.round(scrollProgress * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
