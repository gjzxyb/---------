"use client";

import { useState } from "react";

import { deleteTeachingClass, deleteTeachingClasses } from "@/app/actions/base-data";

type TeachingClassListItem = {
  id: string;
  name: string;
  term: string;
  course: { code: string; name: string };
  organization: { name: string } | null;
  teacher: { name: string };
  _count: { assignments: number; enrollments: number };
};

export function TeachingClassListTable({
  teachingClasses,
}: {
  teachingClasses: TeachingClassListItem[];
}) {
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

      return teachingClasses
        .filter((teachingClass) => !currentIdSet.has(teachingClass.id))
        .map((teachingClass) => teachingClass.id);
    });
  }

  return (
    <>
      <form id="delete-classes-form" action={deleteTeachingClasses}>
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
      </form>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">教学班列表</h2>
          <p className="mt-1 text-sm text-slate-500">
            已选择 {selectedIds.length} 个教学班。批量删除仍仅删除无评教派发的教学班。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedIds(teachingClasses.map((item) => item.id))} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">全选</button>
          <button type="button" onClick={invertSelection} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">反选</button>
          <button type="button" onClick={() => setSelectedIds([])} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">取消选择</button>
          <button form="delete-classes-form" disabled={selectedIds.length === 0} className="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400">批量删除选中</button>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {["选择", "教学班", "课程", "教师", "组织", "选课/派发", "操作"].map((header) => (
                <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {teachingClasses.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">暂无教学班。</td></tr>
            ) : null}
            {teachingClasses.map((teachingClass) => {
              const canDelete = teachingClass._count.assignments === 0;
              const selected = selectedIdSet.has(teachingClass.id);

              return (
                <tr key={teachingClass.id} className={selected ? "bg-sky-50/40" : undefined}>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <input type="checkbox" checked={selected} onChange={() => toggle(teachingClass.id)} aria-label={`选择 ${teachingClass.name}`} className="h-4 w-4 rounded border-slate-300 text-sky-700" />
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">{teachingClass.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{teachingClass.term}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">{teachingClass.course.name} ({teachingClass.course.code})</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{teachingClass.teacher.name}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{teachingClass.organization?.name ?? "未归属"}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{teachingClass._count.enrollments} / {teachingClass._count.assignments}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <form action={deleteTeachingClass}>
                      <input type="hidden" name="id" value={teachingClass.id} />
                      <button disabled={!canDelete} title={canDelete ? "删除教学班" : "已有评教派发，不可删除"} className="text-sm font-medium text-rose-700 disabled:text-slate-400">删除</button>
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
