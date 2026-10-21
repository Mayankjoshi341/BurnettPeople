const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false",
};

export function LockIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  );
}

export function MailIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.4" />
      <path d="m4 7.5 8 6 8-6" />
    </svg>
  );
}

export function EyeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10.6 5.7A10 10 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.2 3.9" />
      <path d="M6.6 6.9A16.6 16.6 0 0 0 2 12s3.6 6.5 10 6.5c1.6 0 3-.4 4.3-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

export function ShieldCheckIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </svg>
  );
}

export function ShieldLockIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6L12 3Z" />
      <rect x="9.3" y="10.8" width="5.4" height="4.4" rx="1" />
      <path d="M10.4 10.8V9.7a1.6 1.6 0 0 1 3.2 0v1.1" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path
        d="m7.2 12.3 3.1 3.1 6.4-6.6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmptyCircleIcon({ size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

export function HomeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 11 12 3.8l8.5 7.2" />
      <path d="M5.5 9.8V20h13V9.8" />
      <path d="M10 20v-5.5h4V20" />
    </svg>
  );
}

export function ArrowLeftIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </svg>
  );
}

export function ArrowRightIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function HelpCircleIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8" />
      <circle cx="12" cy="16.9" r=".6" fill="currentColor" />
    </svg>
  );
}

export function ExternalIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function InfoIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 11v5.2" />
      <circle cx="12" cy="7.9" r=".7" fill="currentColor" />
    </svg>
  );
}

export function UserIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20c.6-3.6 3.6-5.6 7.2-5.6s6.6 2 7.2 5.6" />
    </svg>
  );
}

export function CheckIcon(props) {
  return (
    <svg {...base} strokeWidth={2.6} {...props}>
      <path d="m5 12.8 4.4 4.4L19 7.4" />
    </svg>
  );
}
