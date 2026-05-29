import { describe, expect, it } from "vitest";

import { buildPageContext } from "../lib/page-context";
import { navigationTree } from "../lib/navigation";

describe("page context breadcrumbs", () => {
  it("shows base data hierarchy and parent return target", () => {
    const context = buildPageContext("/admin/base-data/students", navigationTree);

    expect(context.breadcrumbs.map((crumb) => crumb.title)).toEqual([
      "工作台",
      "管理中心",
      "基础数据",
      "学生管理",
    ]);
    expect(context.parentHref).toBe("/admin/base-data");
  });

  it("shows teacher result detail hierarchy", () => {
    const context = buildPageContext("/teacher/results/class-1", navigationTree);

    expect(context.breadcrumbs.map((crumb) => crumb.title)).toEqual([
      "工作台",
      "教师发展",
      "评价结果",
      "评价详情",
    ]);
    expect(context.parentHref).toBe("/teacher/results");
  });

  it("shows student evaluation detail hierarchy", () => {
    const context = buildPageContext(
      "/student/evaluations/assignment-1",
      navigationTree,
    );

    expect(context.breadcrumbs.map((crumb) => crumb.title)).toEqual([
      "工作台",
      "学生评教",
      "我的评教",
      "填写评教",
    ]);
    expect(context.parentHref).toBe("/student/evaluations");
  });

  it("returns first-level business pages to the dashboard", () => {
    const context = buildPageContext("/student/evaluations", navigationTree);

    expect(context.breadcrumbs.map((crumb) => crumb.title)).toEqual([
      "工作台",
      "学生评教",
      "我的评教",
    ]);
    expect(context.parentHref).toBe("/dashboard");
    expect(context.parentLabel).toBe("回到工作台");
  });

  it("includes current section menu items", () => {
    const context = buildPageContext("/teacher/results", navigationTree);

    expect(context.sectionTitle).toBe("教师发展");
    expect(context.sectionItems.map((item) => item.title)).toEqual([
      "授课班级",
      "评价结果",
      "改进计划",
    ]);
    expect(context.sectionItems.find((item) => item.current)?.title).toBe("评价结果");
  });

  it("keeps section menu active on nested pages", () => {
    const context = buildPageContext("/admin/base-data/students", navigationTree);

    expect(context.sectionTitle).toBe("管理中心");
    expect(context.sectionItems.find((item) => item.current)?.title).toBe("学生管理");
  });

  it("keeps organization pages linked back to dashboard and base data", () => {
    const context = buildPageContext(
      "/admin/base-data/organizations",
      navigationTree,
    );

    expect(context.breadcrumbs.map((crumb) => crumb.title)).toEqual([
      "工作台",
      "管理中心",
      "基础数据",
      "组织结构",
    ]);
    expect(context.breadcrumbs[0]?.href).toBe("/dashboard");
    expect(context.parentHref).toBe("/admin/base-data");
  });

  it("does not show a return target on top-level pages", () => {
    const context = buildPageContext("/dashboard", navigationTree);

    expect(context.breadcrumbs.map((crumb) => crumb.title)).toEqual([
      "统一门户",
      "工作台",
    ]);
    expect(context.parentHref).toBeUndefined();
  });
});
