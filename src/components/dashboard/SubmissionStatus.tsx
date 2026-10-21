export function SubmissionStatus({ message, ok }: { message?: string; ok?: boolean }) {
  if (!message) return null;
  return <p aria-live="polite" className={`rounded-lg px-4 py-3 text-sm ${ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`} role="status">{message}</p>;
}
