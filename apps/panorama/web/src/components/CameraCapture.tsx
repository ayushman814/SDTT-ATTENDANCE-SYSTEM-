import { useEffect, useRef, useState } from "react";

/** Live camera preview that produces a JPEG Blob on capture. */
export default function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError("Camera unavailable — please upload a photo instead."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((b) => b && onCapture(b), "image/jpeg", 0.92);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-4">
        {error ? (
          <p className="py-8 text-center text-red-600">{error}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black" />
        )}
        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-300 py-2.5 font-medium text-slate-700"
          >
            Cancel
          </button>
          {!error && (
            <button
              onClick={capture}
              className="flex-1 rounded-xl bg-teal-700 py-2.5 font-semibold text-white"
            >
              Capture
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
