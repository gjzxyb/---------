"use client";

import { useState } from "react";

import { deleteTeacher, deleteTeachers } from "@/app/actions/base-data";

type TeacherListItem = {
  id: string;
  email: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "GRADUATED";
  organization: { name: string };
  teacherProfile: {
    teacherNo: string;
    title: string | null;
  } | null;
  _count: {
    taughtClasses: number;
  };
};

export function TeacherListTable({ teachers }: { teachers: TeacherListItem[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedIdSet = new Set(selectedIds);

  function toggleTeacher(teacherId: string) {
    setSelectedIds((currentIds) =>
      currentIds.includes(teacherId)
        ? currentIds.filter((id) => id !== teacherId)
        : [...currentIds, teacherId],
    );
  }

  return (
    <>
      <form id="delete-teachers-form" action={deleteTeachers}>
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
      </form>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">教师列表</h2>
          <p className="mt-1 text-sm text-slate-500">
            已选择 {selectedIds.length} 名教师。批量删除仍仅删除无授课班级的教师。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedIds(teachers.map((teacher) => teacher.id))} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            全选
          </button>
          <button
            type="button"
            onClick={() =>
              setSelectedIds((currentIds) => {
                const currentIdSet = new Set(currentIds);

                return teachers
                  .filter((teacher) => !currentIdSet.has(teacher.id))
                  .map((teacher) => teacher.id);
              })
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            反选
          </button>
          <button type="button" onClick={() => setSelectedIds([])} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            取消选择
          </button>
          <button form="delete-teachers-form" disabled={selectedIds.length === 0} className="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400">
            批量删除选中
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {["选择", "教师", "工号", "职称", "组织", "状态", "授课班级", "操作"].map((header) => (
                <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {teachers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  暂无教师数据。
                </td>
              </tr>
            ) : null}
            {teachers.map((teacher) => {
              const canDelete = teacher._count.taughtClasses === 0;
              const selected = selectedIdSet.has(teacher.id);

              return (
                <tr key={teacher.id} className={selected ? "bg-sky-50/40" : undefined}>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <input type="checkbox" checked={selected} onChange={() => toggleTeacher(teacher.id)} aria-label={`选择 ${teacher.name}`} className="h-4 w-4 rounded border-slate-300 text-sky-700" />
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">{teacher.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{teacher.email}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {teacher.teacherProfile?.teacherNo ?? "未建档"}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {teacher.teacherProfile?.title ?? "未设置"}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {teacher.organization.name}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {teacher.status === "ACTIVE" ? "启用" : "停用"}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {teacher._count.taughtClasses}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <form action={deleteTeacher}>
                      <input type="hidden" name="id" value={teacher.id} />
                      <button disabled={!canDelete} title={canDelete ? "删除教师" : "已有授课班级，不可删除"} className="text-sm font-medium text-rose-700 disabled:text-slate-400">
                        删除
                      </button>
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
