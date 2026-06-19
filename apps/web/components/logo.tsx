/* eslint-disable @next/next/no-img-element */
import logoImg from '@/public/logo.png';

/**
 * The PartEngine logo + wordmark. The PNG is imported as a static asset so Next
 * fingerprints it into .next/static (served at /_next/static in every build),
 * rather than relying on /public being staged. The mark is wide (trimmed of its
 * transparent margins), so it's sized by HEIGHT with auto width to avoid
 * distortion.
 */
export function Logo({
  size = 40,
  showWordmark = true,
  className = '',
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={logoImg.src}
        alt="PartEngine"
        style={{ height: size, width: 'auto' }}
        className="shrink-0"
      />
      {showWordmark && <span className="text-lg font-bold">PartEngine</span>}
    </div>
  );
}

/** Just the mark (no wordmark), for centered headers like the auth screen. */
export function LogoMark({ size = 96, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={logoImg.src}
      alt="PartEngine"
      style={{ height: size, width: 'auto' }}
      className={`mx-auto ${className}`}
    />
  );
}
