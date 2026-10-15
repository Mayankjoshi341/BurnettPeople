export function userDisplayName(user) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return name || user?.email || "Signed-in user";
}

export function userInitials(user) {
  const name = userDisplayName(user);
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
}

export function roleLabel(role) {
  return ({ ADMIN: "Admin", HR: "HR", MANAGER: "Manager", EMPLOYEE: "Employee" })[role] || role || "User";
}
