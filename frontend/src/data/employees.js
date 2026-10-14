const STORAGE_KEY = "burnettpeople_demo_employees";

const initialEmployees = [
  { id: "BP001", name: "Aarav Sharma", email: "aarav@example.com", department: "Engineering", role: "Employee", designation: "Software Engineer", phone: "", joiningDate: "2026-01-12", employmentType: "Full-time", manager: "", status: "Active", invitationStatus: "Not sent" },
  { id: "BP002", name: "Priya Verma", email: "priya@example.com", department: "Human Resources", role: "HR", designation: "HR Executive", phone: "", joiningDate: "2026-02-10", employmentType: "Full-time", manager: "", status: "Active", invitationStatus: "Not sent" },
  { id: "BP003", name: "Rohan Mehta", email: "rohan@example.com", department: "Design", role: "Manager", designation: "Design Manager", phone: "", joiningDate: "2026-03-05", employmentType: "Full-time", manager: "", status: "Active", invitationStatus: "Not sent" },
  { id: "BP004", name: "Ananya Singh", email: "ananya@example.com", department: "Finance", role: "Employee", designation: "Finance Associate", phone: "", joiningDate: "2026-04-01", employmentType: "Full-time", manager: "", status: "Inactive", invitationStatus: "Not sent" },
];

function readEmployees() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.warn("Could not read demo employee data.", error);
  }

  return initialEmployees.map((employee) => ({ ...employee }));
}

export let demoEmployees = readEmployees();

function persistEmployees() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoEmployees));
  } catch (error) {
    console.warn("Could not save demo employee data.", error);
  }
}

export function addDemoEmployee(employee) {
  const cleanId = employee.id.trim();
  const cleanEmail = employee.email.trim().toLowerCase();

  if (demoEmployees.some((item) => item.id.trim().toLowerCase() === cleanId.toLowerCase())) {
    throw new Error("This Employee ID already exists.");
  }

  if (demoEmployees.some((item) => item.email.trim().toLowerCase() === cleanEmail)) {
    throw new Error("This email address is already registered.");
  }

  demoEmployees = [
    ...demoEmployees,
    {
      ...employee,
      id: cleanId,
      email: cleanEmail,
      invitationStatus: "Pending",
    },
  ];

  persistEmployees();
}

export function resendDemoInvitation(employeeId) {
  const employeeExists = demoEmployees.some((item) => item.id === employeeId);

  if (!employeeExists) {
    throw new Error("Employee not found.");
  }

  demoEmployees = demoEmployees.map((employee) =>
    employee.id === employeeId
      ? { ...employee, invitationStatus: "Pending" }
      : employee
  );

  persistEmployees();
}