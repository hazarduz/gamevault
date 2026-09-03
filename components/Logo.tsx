// The GameVault crest — an arcade joystick on a heraldic shield. Kept in
// sync with app/icon.svg (the favicon).
export default function Logo({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M32 5 L55 12.5 V30 C55 45 45.5 54 32 59 C18.5 54 9 45 9 30 V12.5 Z"
        fill="none"
        stroke="#E3A63E"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M12 24 H52" stroke="#E3A63E" strokeWidth="1.6" opacity="0.4" />
      <g fill="#E3A63E">
        <rect x="22" y="43" width="20" height="6" rx="3" />
        <rect x="30" y="26" width="4" height="18" rx="2" />
        <circle cx="32" cy="24" r="6" />
        <circle cx="14.5" cy="16" r="1.8" opacity="0.85" />
        <circle cx="49.5" cy="16" r="1.8" opacity="0.85" />
      </g>
      <circle cx="30" cy="22" r="2" fill="#F3C877" />
    </svg>
  );
}
