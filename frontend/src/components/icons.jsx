/* Inline SVG icons (no extra package needed). Every icon accepts width/height and any svg prop. */
function base(props, children, size = 20) {
  const { width = size, height = size, ...rest } = props;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const LockIcon = (p) =>
  base(p, <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /><circle cx="12" cy="15.5" r="1" /></>);

export const MailIcon = (p) =>
  base(p, <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 7.5l8.5 6 8.5-6" /></>);

export const EyeIcon = (p) =>
  base(p, <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>);

export const EyeOffIcon = (p) =>
  base(p, <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M3 3l18 18" /></>);

export const ShieldCheckIcon = (p) =>
  base(p, <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>);

export const ShieldLockIcon = (p) =>
  base(p, <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><rect x="9" y="10.5" width="6" height="5" rx="1" /><path d="M10.5 10.5V9a1.5 1.5 0 0 1 3 0v1.5" /></>);

/* Filled green tick (password rule met) */
export const CheckCircleFilledIcon = (p) =>
  base(p, <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth="2.2" /></>, 18);

/* Hollow circle (password rule not met yet) */
export const CircleIcon = (p) => base(p, <circle cx="12" cy="12" r="9.5" />, 18);

export const UserIcon = (p) =>
  base(p, <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>);

export const ArrowRightIcon = (p) => base(p, <path d="M5 12h14M13 6l6 6-6 6" />);
export const ArrowLeftIcon = (p) => base(p, <path d="M19 12H5M11 6l-6 6 6 6" />);

export const HomeIcon = (p) =>
  base(p, <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /></>);

export const InfoCircleIcon = (p) =>
  base(p, <><circle cx="12" cy="12" r="9.5" /><path d="M12 11v5.5" /><path d="M12 7.6v.01" strokeWidth="2.4" /></>, 26);

export const HelpCircleIcon = (p) =>
  base(p, <><circle cx="12" cy="12" r="9.5" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8" /><path d="M12 16.9v.01" strokeWidth="2.4" /></>, 22);

export const ExternalLinkIcon = (p) =>
  base(p, <><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>, 18);