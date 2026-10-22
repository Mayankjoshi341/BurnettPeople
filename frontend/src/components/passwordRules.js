// The checklist shown on the "Set Up Your Password" and "Reset Your Password" screens.
// This is only guidance for the user: your Django password validators stay the final authority.
export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters long", test: (v) => v.length >= 8 },
  { id: "upper", label: "Include at least one uppercase letter (A–Z)", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "Include at least one lowercase letter (a–z)", test: (v) => /[a-z]/.test(v) },
  { id: "number", label: "Include at least one number (0–9)", test: (v) => /[0-9]/.test(v) },
  { id: "special", label: "Include at least one special character (e.g. ! @ # $ %)", test: (v) => /[^A-Za-z0-9\s]/.test(v) },
];

export function passwordIsStrong(password) {
  return PASSWORD_RULES.every((rule) => rule.test(password || ""));
}