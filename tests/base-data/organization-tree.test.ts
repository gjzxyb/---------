import { describe, expect, it } from "vitest";

import { flattenOrganizationTree } from "../../lib/base-data/organization-tree";

describe("flattenOrganizationTree", () => {
  it("places children directly under their parent and keeps a stable sibling order", () => {
    const flattened = flattenOrganizationTree([
      { id: "dept-2", name: "计算机学院", parentId: "university", type: "DEPARTMENT" },
      { id: "school", name: "凉山民中", parentId: null, type: "SCHOOL" },
      { id: "class-1", name: "软件工程 2026-1 班", parentId: "dept-2", type: "CLASS" },
      { id: "university", name: "示范大学", parentId: null, type: "SCHOOL" },
      { id: "dept-1", name: "人文学院", parentId: "university", type: "DEPARTMENT" },
    ]);

    expect(flattened.map((item) => item.id)).toEqual([
      "school",
      "university",
      "dept-2",
      "class-1",
      "dept-1",
    ]);
    expect(flattened.find((item) => item.id === "class-1")).toMatchObject({
      depth: 2,
      path: "示范大学 / 计算机学院 / 软件工程 2026-1 班",
    });
  });

  it("appends orphaned nodes after valid root trees", () => {
    const flattened = flattenOrganizationTree([
      { id: "orphan", name: "孤立组织", parentId: "missing", type: "CLASS" },
      { id: "root", name: "根组织", parentId: null, type: "SCHOOL" },
    ]);

    expect(flattened.map((item) => item.id)).toEqual(["root", "orphan"]);
    expect(flattened.find((item) => item.id === "orphan")?.depth).toBe(0);
  });
});
