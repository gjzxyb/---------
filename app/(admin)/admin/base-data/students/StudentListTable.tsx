"use client";

import { useState } from "react";

import {
  deleteStudent,
  deleteStudents,
  markStudentGraduated,
  markStudentsGraduated,
  restoreGraduatedStudent,
} from "@/app/actions/base-data";

type StudentListItem = {
  id: string;
  email: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "GRADUATED";
  organization: { name: string };
  studentProfile: {
    grade: string | null;
    major: string | null;
    studentNo: string;
  } | null;
  _count: {
    assignments: number;
    enrollments: number;
  };
};

function statusLabel(status: StudentListItem["status"]) {
  if (status === "ACTIVE") {
    return "启用";
  }

  if (status === "GRADUATED") {
    return "已毕业";
  }

  return "停用";
}

export function StudentListTable({ students }: { students: StudentListItem[] }) {
  const [selectedIds, setSelectedIds] = useStudentSelection();
  const selectedIdSet = new Set(selectedIds);

  function toggleStudent(studentId: string) {
    setSelectedIds((currentIds) =>
      currentIds.includes(studentId)
        ? currentIds.filter((id) => id !== studentId)
        : [...currentIds, studentId],
    );
  }

  function selectAll() {
    setSelectedIds(students.map((student) => student.id));
  }

  function invertSelection() {
    setSelectedIds((currentIds) => {
      const currentIdSet = new Set(currentIds);

      return students
        .filter((student) => !currentIdSet.has(student.id))
        .map((student) => student.id);
    });
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  return (
    <>
      <form id="delete-students-form" action={deleteStudents}>
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
      </form>
      <form id="graduate-students-form" action={markStudentsGraduated}>
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
      </form>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">学生列表</h2>
          <p className="mt-1 text-sm text-slate-500">
            已选择 {selectedIds.length} 名学生。批量删除仍仅删除无选课、无评教派发的学生。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            全选
          </button>
          <button
            type="button"
            onClick={invertSelection}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            反选
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            取消选择
          </button>
          <button
            form="graduate-students-form"
            disabled={selectedIds.length === 0}
            className="rounded-md border border-amber-200 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            批量标记毕业
          </button>
          <button
            form="delete-students-form"
            disabled={selectedIds.length === 0}
            className="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            批量删除选中
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {["选择", "学生", "学号", "年级/专业", "组织", "状态", "选课/评教", "操作"].map((header) => (
                <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {students.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  暂无学生数据。
                </td>
              </tr>
            ) : null}
            {students.map((student) => {
              const canDelete =
                student._count.enrollments === 0 && student._count.assignments === 0;
              const selected = selectedIdSet.has(student.id);

              return (
                <tr key={student.id} className={selected ? "bg-sky-50/40" : undefined}>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleStudent(student.id)}
                      aria-label={`选择 ${student.name}`}
                      className="h-4 w-4 rounded border-slate-300 text-sky-700"
                    />
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">{student.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{student.email}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {student.studentProfile?.studentNo ?? "未建档"}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {student.studentProfile?.grade ?? "-"} / {student.studentProfile?.major ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {student.organization.name}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {statusLabel(student.status)}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {student._count.enrollments} / {student._count.assignments}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div className="flex flex-col gap-2">
                      {student.status === "GRADUATED" ? (
                        <form action={restoreGraduatedStudent}>
                          <input type="hidden" name="id" value={student.id} />
                          <button className="text-sm font-medium text-sky-700">
                            恢复启用
                          </button>
                        </form>
                      ) : (
                        <form action={markStudentGraduated}>
                          <input type="hidden" name="id" value={student.id} />
                          <button className="text-sm font-medium text-amber-700">
                            标记毕业
                          </button>
                        </form>
                      )}
                      <form action={deleteStudent}>
                        <input type="hidden" name="id" value={student.id} />
                        <button disabled={!canDelete} title={canDelete ? "删除学生" : "已有选课或评教派发，不可删除"} className="text-sm font-medium text-rose-700 disabled:text-slate-400">
                          删除
                        </button>
                      </form>
                    </div>
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

function useStudentSelection() {
  return useState<string[]>([]);
}
