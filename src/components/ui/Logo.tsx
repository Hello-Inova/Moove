import Image from "next/image";

const LOGO_ASPECT_RATIO = 1550 / 520;

export function Logo({ height = 32, className }: { height?: number; className?: string }) {
  const width = Math.round(height * LOGO_ASPECT_RATIO);
  return (
    <Image
      src="/logo.svg"
      alt="Moove"
      width={width}
      height={height}
      priority
      unoptimized
      className={className}
    />
  );
}
