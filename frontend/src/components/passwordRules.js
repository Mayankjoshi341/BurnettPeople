export const PASSWORD_RULES = [
  {
    id: "length",
    label: "At least 8 characters long",
    test: (value) => value.length >= 8,
  },
  {
    id: "upper",
    label: "Include at least one uppercase letter (A–Z)",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "lower",
    label: "Include at least one lowercase letter (a–z)",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "number",
    label: "Include at least one number (0–9)",
    test: (value) => /[0-9]/.test(value),
  },
  {
    id: "special",
    label: "Include at least one special character (e.g. ! @ # $ %)",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

export function passwordIsStrong(value) {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}
