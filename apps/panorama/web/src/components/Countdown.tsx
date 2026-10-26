import { useEffect, useState } from "react";

export default function Countdown({ endTime }: { endTime: string }) {
  const [left, setLeft] = useState(() => new Date(endTime).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(new Date(endTime).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [endTime]);
  if (left <= 0) return <span className="font-mono text-red-600">closed</span>;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className="font-mono font-semibold text-teal-700">
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}
