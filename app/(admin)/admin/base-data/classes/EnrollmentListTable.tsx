"use client";

import { useState } from "react";

import { deleteEnrollment, deleteEnrollments } from "@/app/actions/base-data";

type EnrollmentListItem = {
  id: string;
  studentId: string;
  student: {
    email: string;
    name: string;
    studentProfile: { studentNo: string } | null;
  };
  teachingClass: {
    assignments: { evaluatorId: string }[];
    name: string;
    term: string;
  };
};

export function EnrollmentListTable({
  enrollments,
}: {
  enrollments: EnrollmentListItem[];
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

      return enrollments
        .filter((enrollment) => !currentIdSet.has(enrollment.id))
        .map((enrollment) => enrollment.id);
    });
  }

  return (
    <>
      <form id="delete-enrollments-form" action={deleteEnrollments}>
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
      </form>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">选课列表</h2>
          <p className="mt-1 text-sm text-slate-500">
            已选择 {selectedIds.length} 条选课。批量移除仍仅移除未产生评教派发的选课。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedIds(enrollments.map((item) => item.id))} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">全选</button>
          <button type="button" onClick={invertSelection} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">反选</button>
          <button type="button" onClick={() => setSelectedIds([])} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">取消选择</button>
          <button form="delete-enrollments-form" disabled={selectedIds.length === 0} className="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400">批量移除选中</button>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {["选择", "教学班", "学生", "学号", "评教派发", "操作"].map((header) => (
                <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {enrollments.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">暂无选课记录。</td></tr>
            ) : null}
            {enrollments.map((enrollment) => {
              const hasAssignment = enrollment.teachingClass.assignments.some(
                (assignment) => assignment.evaluatorId === enrollment.studentId,
              );
              const selected = selectedIdSet.has(enrollment.id);

              return (
                <tr key={enrollment.id} className={selected ? "bg-sky-50/40" : undefined}>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <input type="checkbox" checked={selected} onChange={() => toggle(enrollment.id)} aria-label={`选择 ${enrollment.student.name}`} className="h-4 w-4 rounded border-slate-300 text-sky-700" />
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">{enrollment.teachingClass.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{enrollment.teachingClass.term}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">{enrollment.student.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{enrollment.student.email}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">{enrollment.student.studentProfile?.studentNo ?? "未建档"}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{hasAssignment ? "已派发" : "未派发"}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <form action={deleteEnrollment}>
                      <input type="hidden" name="id" value={enrollment.id} />
                      <button disabled={hasAssignment} title={hasAssignment ? "已有评教派发，不可移除" : "移除选课"} className="text-sm font-medium text-rose-700 disabled:text-slate-400">移除</button>
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
