"use client";

import { useState } from "react";

import { deleteCourse, deleteCourses } from "@/app/actions/base-data";
import { StatusBadge } from "@/components/status-badge";

type CourseListItem = {
  id: string;
  code: string;
  name: string;
  organization: { name: string } | null;
  _count: { teachingClasses: number };
};

export function CourseListTable({ courses }: { courses: CourseListItem[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedIdSet = new Set(selectedIds);

  function toggle(id: string) {
    setSelectedIds((currentIds) =>
      currentIds.includes(id)
        ? currentIds.filter((currentId) => currentId !== id)
        : [...currentIds, id],
    );
  }

  function invertSelection() {
    setSelectedIds((currentIds) => {
      const currentIdSet = new Set(currentIds);

      return courses
        .filter((course) => !currentIdSet.has(course.id))
        .map((course) => course.id);
    });
  }

  return (
    <>
      <form id="delete-courses-form" action={deleteCourses}>
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
      </form>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">课程列表</h2>
          <p className="mt-1 text-sm text-slate-500">
            已选择 {selectedIds.length} 门课程。批量删除仍仅删除未关联教学班的课程。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedIds(courses.map((course) => course.id))} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">全选</button>
          <button type="button" onClick={invertSelection} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">反选</button>
          <button type="button" onClick={() => setSelectedIds([])} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">取消选择</button>
          <button form="delete-courses-form" disabled={selectedIds.length === 0} className="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400">批量删除选中</button>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {["选择", "课程", "归属组织", "教学班数", "状态", "操作"].map((header) => (
                <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {courses.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">暂无课程数据。</td></tr>
            ) : null}
            {courses.map((course) => {
              const canDelete = course._count.teachingClasses === 0;
              const selected = selectedIdSet.has(course.id);

              return (
                <tr key={course.id} className={selected ? "bg-sky-50/40" : undefined}>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <input type="checkbox" checked={selected} onChange={() => toggle(course.id)} aria-label={`选择 ${course.name}`} className="h-4 w-4 rounded border-slate-300 text-sky-700" />
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">{course.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{course.code}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">{course.organization?.name ?? "未归属"}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{course._count.teachingClasses}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <StatusBadge tone={canDelete ? "neutral" : "success"}>{canDelete ? "未关联" : "已关联"}</StatusBadge>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <form action={deleteCourse}>
                      <input type="hidden" name="id" value={course.id} />
                      <button disabled={!canDelete} title={canDelete ? "删除课程" : "已有教学班，不可删除"} className="text-sm font-medium text-rose-700 disabled:text-slate-400">删除</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
