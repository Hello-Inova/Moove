export const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-base text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/15";

export const primaryButtonClass =
  "w-full rounded-xl bg-brand-navy px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-brand-navy-light active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export const secondaryButtonClass =
  "rounded-xl border border-neutral-300 bg-white px-4 py-2 font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export const dangerButtonClass =
  "rounded-xl border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-700 transition hover:bg-red-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export const cardClass = "rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600">{message}</p>;
}
