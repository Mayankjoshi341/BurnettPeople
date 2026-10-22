// Where each role lands after login. Used by App.jsx and the error pages.
export const ROLE_HOME = {
  ADMIN: "/admin",
  HR: "/hr",
  MANAGER: "/manager",
  EMPLOYEE: "/employee",
};

export function homeForUser(user) {
  return ROLE_HOME[user?.role] || "/";
}