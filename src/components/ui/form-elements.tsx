export const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500";

export const primaryButtonClass =
  "w-full rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButtonClass =
  "rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600">{message}</p>;
}
