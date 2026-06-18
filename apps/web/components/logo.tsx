/* eslint-disable @next/next/no-img-element */
import logoImg from '@/public/logo.png';

/**
 * The PartEngine logo + wordmark. The PNG is imported as a static asset so Next
 * fingerprints it into .next/static (served at /_next/static in every build),
 * rather than relying on /public being staged — the desktop standalone bundle
 * does not ship /public unless prepare-bundles.mjs copies it. Plain <img> with
 * the imported .src avoids next/image's runtime optimizer (no sharp needed in
 * the packaged server).
 */
export function Logo({
  size = 28,
  showWordmark = true,
  className = '',
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src={logoImg.src} alt="PartEngine" width={size} height={size} className="shrink-0" />
      {showWordmark && <span className="text-lg font-bold">PartEngine</span>}
    </div>
  );
}

/** Just the mark (no wordmark), for centered headers like the auth screen. */
export function LogoMark({ size = 64, className = '' }: { size?: number; className?: string }) {
  return <img src={logoImg.src} alt="PartEngine" width={size} height={size} className={className} />;
}
