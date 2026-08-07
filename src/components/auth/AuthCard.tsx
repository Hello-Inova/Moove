import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: { href: string; label: string; linkLabel: string };
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm text-neutral-500">
          ← Moove
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && (
          <p className="mt-6 text-center text-sm text-neutral-600">
            {footer.label}{" "}
            <Link href={footer.href} className="font-medium text-neutral-900 underline">
              {footer.linkLabel}
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
