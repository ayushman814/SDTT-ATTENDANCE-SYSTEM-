const STYLES: Record<string, string> = {
  present: "bg-teal-50 text-teal-800 ring-teal-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  pending_review: "bg-amber-50 text-amber-800 ring-amber-200",
  processing: "bg-slate-100 text-slate-600 ring-slate-200",
  closed: "bg-slate-100 text-slate-600 ring-slate-200",
};

const LABELS: Record<string, string> = {
  present: "Present",
  rejected: "Rejected",
  pending_review: "Needs review",
  processing: "Processing",
  closed: "Closed",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STYLES[status] ?? STYLES.processing}`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
