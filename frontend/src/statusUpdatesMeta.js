/* Shared by EVERY dashboard (Admin / HR / Manager / Employee) so the heading, subtitle
   and sidebar item are identical to the reference design and defined in one place. */

export const STATUS_UPDATES_META = {
  EMPLOYEE: ["Status Updates", "Share your daily progress, track your updates, and stay aligned with your team."],
  MANAGER: ["Status Updates", "Share your progress and review your team's updates."],
  HR: ["Status Updates", "Share your progress and review updates from all employees and managers."],
  ADMIN: ["Status Updates", "Review daily progress updates from all employees and managers."],
};

// Sidebar item (label as in the reference images). Icon "file" exists in DashboardIcons.
export const STATUS_UPDATES_NAV = { id: "status-updates", label: "Status Updates", icon: "file" };