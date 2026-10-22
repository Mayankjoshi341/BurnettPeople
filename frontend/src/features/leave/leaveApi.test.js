import test from "node:test";
import assert from "node:assert/strict";

import {
  estimateWorkingDays,
  leaveMarks,
  normalizeLeaveBalance,
  normalizeLeaveRequest,
  rangesOverlap,
  requestLeaveDraft,
  upcomingLeave,
} from "./leaveApi.js";

test("normalizeLeaveRequest maps API fields to display fields", () => {
  const row = normalizeLeaveRequest({
    id: 7, employee_name: "Asha Rao", employee_code: "EMP-1", department_name: "Design",
    leave_type: 2, start_date: "2026-11-02", end_date: "2026-11-04", total_days: 3,
    reason: "Family event", status: "APPROVED",
  }, 0, { 2: "Annual Leave" });
  assert.equal(row.type, "Annual Leave");
  assert.equal(row.status, "Approved");
  assert.equal(row.days, "3 days");
  assert.equal(row.dates, "02 Nov – 04 Nov 2026");
});

test("normalizeLeaveBalance derives remaining days", () => {
  const b = normalizeLeaveBalance({ id: 1, leave_type: 1, leave_type_name: "Sick Leave", total_days: 8, used_days: 3 });
  assert.equal(b.remaining, 5);
  assert.equal(b.name, "Sick Leave");
});

test("rangesOverlap is inclusive and handles missing dates", () => {
  assert.equal(rangesOverlap("2026-11-02", "2026-11-04", "2026-11-04", "2026-11-06"), true);
  assert.equal(rangesOverlap("2026-11-02", "2026-11-03", "2026-11-04", "2026-11-06"), false);
  assert.equal(rangesOverlap("", "2026-11-03", "2026-11-04", "2026-11-06"), false);
});

test("estimateWorkingDays skips weekends and invalid ranges", () => {
  assert.equal(estimateWorkingDays("2026-10-23", "2026-10-27"), 3); // Fri, Mon, Tue
  assert.equal(estimateWorkingDays("2026-10-27", "2026-10-23"), 0);
});

test("leaveMarks only marks approved leave; upcomingLeave drops past and rejected", () => {
  const rows = [
    normalizeLeaveRequest({ id: 1, start_date: "2026-11-02", end_date: "2026-11-03", status: "APPROVED" }),
    normalizeLeaveRequest({ id: 2, start_date: "2026-11-10", end_date: "2026-11-10", status: "REJECTED" }),
    normalizeLeaveRequest({ id: 3, start_date: "2026-10-01", end_date: "2026-10-02", status: "APPROVED" }),
  ];
  assert.deepEqual(Object.keys(leaveMarks(rows)).sort(), ["2026-10-01", "2026-10-02", "2026-11-02", "2026-11-03"]);
  assert.deepEqual(upcomingLeave(rows, "2026-10-22").map((r) => r.id), [1]);
});

test("requestLeaveDraft returns text and rejects an empty draft", async () => {
  const realFetch = globalThis.fetch;
  const reply = (body) => async () => ({
    ok: true, status: 200,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(body),
  });
  try {
    globalThis.fetch = reply({ draft: "  Hello manager  " });
    assert.equal(await requestLeaveDraft({ leaveType: 1, startDate: "2026-11-02", endDate: "2026-11-02" }), "Hello manager");
    globalThis.fetch = reply({ draft: "" });
    await assert.rejects(() => requestLeaveDraft({ leaveType: 1, startDate: "2026-11-02", endDate: "2026-11-02" }), /did not return a message/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
