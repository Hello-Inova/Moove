import Image from "next/image";

const LOGO_ASPECT_RATIO = 986 / 238;

export function Logo({ height = 32, className }: { height?: number; className?: string }) {
  const width = Math.round(height * LOGO_ASPECT_RATIO);
  return (
    <Image
      src="/logo.png"
      alt="Moove"
      width={width}
      height={height}
      priority
      unoptimized
      className={className}
    />
  );
}
