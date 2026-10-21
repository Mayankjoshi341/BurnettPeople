import { useCallback, useEffect, useState } from "react";

import apiClient from "./api/client";
import { SHOW_DEMO_DATA, getErrorMessage } from "./dashboardUtils";

/* ------------------------------------------------------------------
   Backend contract (adjust to your Django URLs)
   GET  MANAGER_ENDPOINT                         -> { team, week, leaves, assets, activity, schedule, perf, profile }
   POST MANAGER_LEAVE_ENDPOINT + <id>/approve/   -> approve a leave request   (same for /reject/)
   Shapes are described by DEMO below.
   ------------------------------------------------------------------ */
export const MANAGER_ENDPOINT = "/manager/dashboard/";
export const MANAGER_LEAVE_ENDPOINT = "/manager/leaves/";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const WEEK = [[8, 2, 2], [7, 3, 2], [9, 1, 2], [10, 1, 1], [9, 2, 1], [11, 1, 0], [9, 2, 1]].map(([present, leave, absent], i, arr) => {
  const d = new Date();
  d.setDate(d.getDate() - (arr.length - 1 - i));
  return {
    date: iso(d),
    label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    sub: d.toLocaleDateString("en-GB", { weekday: "short" }),
    present, leave, absent,
  };
});

const T = (name, designation, status, check_in = "", check_out = "", work_hours = "", late = false) => ({
  id: name.toLowerCase().replace(/\W+/g, "-"), name, designation, department: "Engineering", status, check_in, check_out, work_hours, late, early: false,
});

export const DEMO = {
  team: [
    T("Aman Verma", "Software Engineer", "Present", "09:01 AM", "06:05 PM", "8h 04m"),
    T("Priya Nair", "Product Designer", "Present", "09:08 AM", "06:21 PM", "8h 13m"),
    T("Karan Mehta", "Backend Developer", "Absent"),
    T("Neha Gupta", "Frontend Developer", "Present", "09:12 AM", "06:32 PM", "8h 20m"),
    T("Vikram Kapoor", "DevOps Engineer", "Present", "08:58 AM", "06:15 PM", "8h 17m"),
    T("Ananya Singh", "QA Engineer", "On Leave"),
    T("Rohit Jain", "Data Analyst", "Present", "09:06 AM", "06:18 PM", "8h 12m"),
    T("Simran Kaur", "UI/UX Designer", "Present", "09:15 AM", "06:28 PM", "8h 13m", true),
    T("Arjun Rao", "Software Engineer", "Present", "09:03 AM", "06:10 PM", "8h 07m"),
    T("Meera Iyer", "Business Analyst", "Present", "09:10 AM", "06:20 PM", "8h 10m"),
    T("Dev Patel", "Software Engineer", "On Leave"),
    T("Isha Nair", "QA Engineer", "Present", "09:00 AM", "06:02 PM", "8h 02m"),
  ],
  week: WEEK,
  leaves: [
    { id: "l1", name: "Ananya Singh", code: "ENG-014", department: "Engineering", type: "Casual Leave", dates: "16 Oct 2026", days: "1 day", status: "Pending" },
    { id: "l2", name: "Karan Mehta", code: "ENG-009", department: "Engineering", type: "Sick Leave", dates: "17 – 18 Oct 2026", days: "2 days", status: "Pending" },
    { id: "l3", name: "Simran Kaur", code: "ENG-021", department: "Design", type: "Personal Leave", dates: "20 Oct 2026", days: "1 day", status: "Pending" },
    { id: "l4", name: "Rohit Jain", code: "ENG-017", department: "Analytics", type: "Casual Leave", dates: "22 – 23 Oct 2026", days: "2 days", status: "Pending" },
    { id: "l5", name: "Neha Gupta", code: "ENG-006", department: "Engineering", type: "Sick Leave", dates: "27 Oct 2026", days: "1 day", status: "Pending" },
  ],
  assets: [
    { id: "a1", device: "MacBook Air M2", type: "Laptop", employee: "Rohit Jain", department: "Analytics", assignedOn: "01 Oct 2026", status: "Assigned" },
    { id: "a2", device: "Dell Latitude 5440", type: "Laptop", employee: "Neha Gupta", department: "Engineering", assignedOn: "15 Sep 2026", status: "Assigned" },
    { id: "a3", device: "Dell Monitor 27\"", type: "Monitor", employee: "Aman Verma", department: "Engineering", assignedOn: "02 Sep 2026", status: "Assigned" },
    { id: "a4", device: "iPhone 14", type: "Mobile", employee: "Priya Nair", department: "Design", assignedOn: "20 Aug 2026", status: "Assigned" },
    { id: "a5", device: "Logitech MX Keys", type: "Accessory", employee: "Simran Kaur", department: "Design", assignedOn: "11 Aug 2026", status: "Assigned" },
  ],
  activity: [
    { icon: "check", title: "Aman Verma checked in", when: "Today, 09:01 AM" },
    { icon: "plane", title: "Ananya Singh applied for Casual Leave", when: "Today, 08:45 AM" },
    { icon: "alert", title: "Attendance exception from Karan Mehta", when: "Yesterday, 04:20 PM" },
    { icon: "laptop", title: "New asset assigned to Rohit Jain", when: "Yesterday, 11:30 AM" },
    { icon: "users", title: "Isha Nair joined the team", when: "14 Oct 2026, 10:15 AM" },
  ],
  schedule: [
    { name: "Aman Verma", department: "Engineering", today: "9:00 AM – 6:00 PM", tomorrow: "9:00 AM – 6:00 PM", status: "Working" },
    { name: "Priya Nair", department: "Design", today: "9:00 AM – 6:00 PM", tomorrow: "9:00 AM – 6:00 PM", status: "Working" },
    { name: "Neha Gupta", department: "Engineering", today: "9:30 AM – 6:30 PM", tomorrow: "9:30 AM – 6:30 PM", status: "Working" },
    { name: "Ananya Singh", department: "QA", today: "Leave", tomorrow: "9:00 AM – 6:00 PM", status: "On Leave" },
  ],
  perf: { rating: "4.2", progress: "85%", atRisk: 2, review: 0 },
  profile: {
    phone: "+91 98765 43210", location: "Indore Office", joined: "15 Mar 2024", dob: "12 May 1998", gender: "Male",
    personalEmail: "rohan.mehta@gmail.com", address: "302, Silver Heights, Indore, Madhya Pradesh",
    reportingTo: "Amit Sharma (CTO)", employmentType: "Full Time", quote: "Good teams build great products.",
    manager: [["Manager Level", "Team Manager"], ["Departments Managed", "Engineering (Frontend)"], ["Projects", "3 Active Projects"], ["Budget Responsibility", "Yes"], ["Hiring Access", "Yes (Request Only)"], ["Leave Review", "View Only (No Approval)"], ["Asset Visibility", "Team Assets"], ["Team Reports", "Full Access to Team Reports"]],
    stats: [["clock", "22", "Work Days", "blue"], ["calendar", "1", "Days on Leave", "green"], ["alert", "3", "Late Arrivals", "red"], ["coffee", "44", "Total Breaks", "purple"], ["clock", "168h 20m", "Total Work Hours", "green"], ["logout", "1", "Early Check-outs", "amber"]],
  },
};

export function summarize(team = []) {
  const total = team.length;
  const c = (s) => team.filter((t) => t.status === s).length;
  const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  return {
    total, present: c("Present"), leave: c("On Leave"), absent: c("Absent"), wfh: c("Work From Home"),
    late: team.filter((t) => t.late).length, early: team.filter((t) => t.early).length, pct,
  };
}

export function useManagerData() {
  const demo = SHOW_DEMO_DATA;
  const [data, setData] = useState(demo ? DEMO : null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      setData(await apiClient.get(MANAGER_ENDPOINT));
      setError("");
    } catch (e) {
      setError(getErrorMessage(e, "Could not load your team data."));
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  async function decideLeave(id, action) {
    if (demo) {
      setData((d) => ({ ...d, leaves: d.leaves.map((l) => (l.id === id ? { ...l, status: action === "approve" ? "Approved" : "Rejected" } : l)) }));
      return;
    }
    await apiClient.post(`${MANAGER_LEAVE_ENDPOINT}${id}/${action}/`, {});
    await load();
  }

  return { data: data || {}, hasData: Boolean(data), loading, error, reload: load, decideLeave };
}
