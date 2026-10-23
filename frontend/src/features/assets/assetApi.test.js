import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSET_ENDPOINTS,
  assignPayload,
  normalizeAsset,
  normalizeAssignment,
  registerPayload,
  returnPayload,
} from "./assetApi.js";

test("asset API paths match Django routes", () => {
  assert.equal(ASSET_ENDPOINTS.assets, "/assets/");
  assert.equal(ASSET_ENDPOINTS.assignments, "/assets/assignments/");
  assert.equal(ASSET_ENDPOINTS.returnAsset(12), "/assets/assignments/12/return/");
});

test("asset request payloads use backend serializer fields", () => {
  assert.deepEqual(registerPayload({ name: "Laptop", type: "Laptop", brand: "Dell", model: "X1", serial: "S1", tag: "BP-1", purchased: "2026-10-22", location: "Indore Office", notes: "" }), {
    name: "Laptop", category: "LAPTOP", manufacturer: "Dell", model: "X1", serial_number: "S1", asset_tag: "BP-1", purchase_date: "2026-10-22", location: "Indore Office", notes: "",
  });
  assert.deepEqual(assignPayload({ assetId: 4, employee: "9", notes: "Issued" }), {
    asset_id: 4, employee_id: 9, notes: "Issued",
  });
  assert.deepEqual(returnPayload({ condition: "Good", notes: "Clean" }), {
    condition_on_return: "Good", notes: "Clean",
  });
});

test("asset serializers normalize current assignments and return history", () => {
  const asset = normalizeAsset({ id: 3, name: "Workstation", category: "DESKTOP", manufacturer: "Dell", asset_tag: "BP-3", status: "ASSIGNED", current_assignment: { employee_name: "Asha Rao", employee_code: "BP009" } });
  assert.equal(asset.type, "Desktop");
  assert.equal(asset.assignedTo, "Asha Rao");
  const assignment = normalizeAssignment({ id: 7, asset: 3, asset_name: "Workstation", assigned_at: "2026-10-23T10:00:00Z", returned_at: "2026-10-23T12:00:00Z", condition_on_return: "Fair" });
  assert.equal(assignment.isActive, false);
  assert.equal(assignment.condition, "Fair");
});
