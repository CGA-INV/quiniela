// SVG icons (Lucide-style stroke 2). 24x24 viewBox; tamaño se setea con className.

type IconProps = { className?: string };

const baseProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function HomeIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

export function BallIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3l3 5-3 4-3-4 3-5z" />
      <path d="M3 12l5 1 4 0 4 0 5-1" />
      <path d="M5 18l3-3 5 0 5 0 3 3" />
    </svg>
  );
}

export function TrophyIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3" />
      <path d="M17 6h3v2a3 3 0 0 1-3 3" />
      <path d="M9 17h6l-1 4h-4l-1-4z" />
      <path d="M12 14v3" />
    </svg>
  );
}

export function CashIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M7 12h.01M17 12h.01" />
    </svg>
  );
}

export function GridIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function CalendarIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}

export function UsersIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="8" r="3" />
      <path d="M21 20c0-2.5-1.5-4.6-3.6-5.5" />
    </svg>
  );
}

export function ActivityIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M3 12h4l3-9 4 18 3-9h4" />
    </svg>
  );
}
