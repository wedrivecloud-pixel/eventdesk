export function AppLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="216"
      height="41"
      viewBox="77 161 2017 379"
      role="img"
      aria-label="Eventdeskly"
    >
      {/* Frame the supplied artwork without its transparent outer padding. */}
      <image href="/eventdeskly-logo.png" width="2172" height="724" />
    </svg>
  );
}
