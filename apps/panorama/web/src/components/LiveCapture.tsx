import { useEffect, useRef, useState } from "react";

const FRONT_SECONDS = 8;
const SWEEP_MAX_SECONDS = 16;
const SWEEP_MIN_FRAMES = 4;
const FRAME_INTERVAL_MS = 600;

type Phase = "front" | "switching" | "sweep" | "uploading";

/**
 * Guided live-capture flow: front camera watches the student for FRONT_SECONDS,
 * grabs the selfie frame, then the camera switches to the back camera and the
 * student sweeps ~180° across the room while frames are sampled. On completion
 * it hands selfie + frames to the parent — there is no file upload path.
 */
export default function LiveCapture({
  onDone,
  onClose,
}: {
  onDone: (selfie: Blob, frames: Blob[]) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<Blob[]>([]);
  const selfieRef = useRef<Blob | null>(null);
  const timersRef = useRef<number[]>([]);
  const [phase, setPhase] = useState<Phase>("front");
  const [countdown, setCountdown] = useState(FRONT_SECONDS);
  const [frameCount, setFrameCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stopStream = () => streamRef.current?.getTracks().forEach((t) => t.stop());

  function grab(): Promise<Blob | null> {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return Promise.resolve(null);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    return new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
  }

  /** Acquire `facing`, then swap — on failure the current stream stays live. */
  async function startCamera(facing: "user" | "environment") {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    stopStream();
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await startCamera("user");
        if (cancelled) return;
        // 8 s of front-camera view, then grab the selfie frame.
        for (let i = FRONT_SECONDS; i >= 1; i--) {
          timersRef.current.push(
            window.setTimeout(() => setCountdown(i - 1), (FRONT_SECONDS - i) * 1000),
          );
        }
        timersRef.current.push(
          window.setTimeout(async () => {
            if (cancelled) return;
            selfieRef.current = await grab();
            setPhase("switching");
            try {
              await startCamera("environment");
            } catch {
              // Single-camera devices (desktops) reject the environment request —
              // the front stream is still live, so sweep with it.
            }
            if (cancelled) return;
            setPhase("sweep");
          }, FRONT_SECONDS * 1000),
        );
      } catch {
        if (!cancelled) setError("Camera access denied — allow the camera to mark attendance.");
      }
    })();
    return () => {
      cancelled = true;
      timersRef.current.forEach(clearTimeout);
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sample frames while sweeping.
  useEffect(() => {
    if (phase !== "sweep") return;
    framesRef.current = [];
    const iv = window.setInterval(async () => {
      const b = await grab();
      if (b) {
        framesRef.current.push(b);
        setFrameCount(framesRef.current.length);
      }
      if (
        framesRef.current.length >= SWEEP_MIN_FRAMES &&
        framesRef.current.length * FRAME_INTERVAL_MS >= SWEEP_MAX_SECONDS * 1000
      ) {
        finish();
      }
    }, FRAME_INTERVAL_MS);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function finish() {
    if (phase !== "sweep" || framesRef.current.length < SWEEP_MIN_FRAMES) return;
    setPhase("uploading");
    stopStream();
    if (selfieRef.current) onDone(selfieRef.current, framesRef.current);
    else setError("Selfie capture failed — please try again.");
  }

  const hints: Record<Phase, string> = {
    front: "Look at the camera — hold still",
    switching: "Switching to the back camera…",
    sweep: "Slowly sweep the camera ~180° across the room — start at the lecturer on the podium and pan across the class",
    uploading: "Uploading…",
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />

      <div className="absolute inset-x-0 top-0 flex justify-center p-4">
        <div className="rounded-full bg-black/60 px-5 py-2 text-center text-sm font-medium text-white">
          {hints[phase]}
        </div>
      </div>

      {phase === "front" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/80 text-4xl font-bold text-white">
            {countdown}
          </div>
        </div>
      )}

      {phase === "sweep" && (
        <div className="absolute inset-x-0 bottom-0 space-y-3 p-5">
          <div className="mx-auto h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-teal-400 transition-all"
              style={{ width: `${Math.min(100, (frameCount / (SWEEP_MAX_SECONDS * 1000 / FRAME_INTERVAL_MS)) * 100)}%` }}
            />
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={onClose}
              className="rounded-xl bg-white/15 px-5 py-2.5 text-sm font-medium text-white"
            >
              Cancel
            </button>
            <button
              onClick={finish}
              disabled={frameCount < SWEEP_MIN_FRAMES}
              className="rounded-xl bg-teal-500 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Done ({frameCount} frames)
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="mx-auto flex max-w-md items-center justify-between rounded-xl bg-red-600 px-4 py-3 text-sm text-white">
            {error}
            <button onClick={onClose} className="ml-3 font-semibold">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
