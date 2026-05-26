import { describe, expect, it } from "vitest";

import { buildCourseListHref, parseCourseListQuery } from "../../lib/base-data/course-management";

describe("course list query", () => {
  it("normalizes filters and pagination", () => {
    expect(
      parseCourseListQuery({
        q: "  程序  ",
        organizationId: " org-1 ",
        teachingClassStatus: "WITH_CLASSES",
        page: "0",
        pageSize: "60",
      }),
    ).toEqual({
      organizationId: "org-1",
      page: 1,
      pageSize: 60,
      q: "程序",
      teachingClassStatus: "WITH_CLASSES",
    });
  });

  it("falls back invalid page size and association status", () => {
    expect(
      parseCourseListQuery({
        teachingClassStatus: "BAD",
        page: "abc",
        pageSize: "999",
      }),
    ).toEqual({
      organizationId: undefined,
      page: 1,
      pageSize: 30,
      q: undefined,
      teachingClassStatus: "ALL",
    });
  });
});

describe("course list href", () => {
  it("preserves filters while updating pagination", () => {
    expect(
      buildCourseListHref(
        {
          organizationId: "org-1",
          page: 2,
          pageSize: 60,
          q: "程序",
          teachingClassStatus: "WITHOUT_CLASSES",
        },
        { page: 3 },
      ),
    ).toBe(
      "/admin/base-data/courses?q=%E7%A8%8B%E5%BA%8F&organizationId=org-1&teachingClassStatus=WITHOUT_CLASSES&page=3&pageSize=60",
    );
  });
});
