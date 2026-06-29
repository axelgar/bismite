// Iris-gradient mark: nested rounded squares with a gradient stroke (Halo Direction A).
// `id` must be unique per page if more than one Logo is rendered (SVG gradient ids are
// document-global). One per page is the norm here, so the default is fine.
export function Logo({ size = 26, id = "irLogo" }: { size?: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="28" height="28" rx="3.5" stroke={`url(#${id})`} strokeWidth="1.8" />
      <rect
        x="9.5"
        y="9.5"
        width="15"
        height="15"
        rx="2.2"
        stroke={`url(#${id})`}
        strokeWidth="1.8"
        opacity=".82"
      />
      <rect x="14.8" y="14.8" width="4.4" height="4.4" rx="1" fill={`url(#${id})`} />
      <defs>
        <linearGradient id={id} x1="3" y1="3" x2="31" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9B7CFF" />
          <stop offset=".5" stopColor="#7CB5FF" />
          <stop offset="1" stopColor="#6EE0D0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Logo size={size} />
      <span className="text-[17px] font-semibold tracking-[-0.01em]">Bismite</span>
    </span>
  );
}
