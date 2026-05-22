import { describe, expect, it } from "vitest";

import { assignmentStatusLabel } from "../../lib/demo-data";

describe("assignmentStatusLabel", () => {
  it("labels pending assignments as waiting to be filled instead of waiting to start", () => {
    expect(assignmentStatusLabel("PENDING")).toBe("待填写");
  });
});
