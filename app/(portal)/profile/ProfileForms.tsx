"use client";

import { useActionState } from "react";

import {
  changeOwnPassword,
  type ProfileActionState,
  updateOwnStudentClass,
  updateOwnProfile,
} from "@/app/actions/profile";
import { passwordComplexityRules } from "@/lib/profile/validation";

const initialState: ProfileActionState = {
  ok: false,
  message: "",
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return (
    <p className="mt-2 text-sm font-medium text-rose-600">
      {messages.join("；")}
    </p>
  );
}

function ActionMessage({ state }: { state: ProfileActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={
        state.ok
          ? "rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
          : "rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
      }
    >
      {state.message}
    </p>
  );
}

export function ProfileUpdateForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(updateOwnProfile, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <ActionMessage state={state} />
      <div>
        <label htmlFor="profile-name" className="text-sm font-medium text-slate-700">
          姓名
        </label>
        <input
          id="profile-name"
          name="name"
          type="text"
          defaultValue={name}
          autoComplete="name"
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <FieldError messages={state.fieldErrors?.name} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "保存中..." : "保存资料"}
      </button>
    </form>
  );
}

export function PasswordChangeForm() {
  const [state, formAction, pending] = useActionState(changeOwnPassword, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <ActionMessage state={state} />
      <div>
        <label
          htmlFor="current-password"
          className="text-sm font-medium text-slate-700"
        >
          当前密码
        </label>
        <input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <FieldError messages={state.fieldErrors?.currentPassword} />
      </div>
      <div>
        <label htmlFor="new-password" className="text-sm font-medium text-slate-700">
          新密码
        </label>
        <input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <FieldError messages={state.fieldErrors?.newPassword} />
      </div>
      <div>
        <label
          htmlFor="confirm-password"
          className="text-sm font-medium text-slate-700"
        >
          确认新密码
        </label>
        <input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <FieldError messages={state.fieldErrors?.confirmPassword} />
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">密码复杂度要求</p>
        <ul className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          {passwordComplexityRules.map((rule) => (
            <li key={rule.label} className="flex items-center gap-2">
              <span aria-hidden="true" className="text-sky-600">
                •
              </span>
              {rule.label}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "修改中..." : "修改密码"}
      </button>
    </form>
  );
}

export function StudentClassUpdateForm({
  classOptions,
  currentOrganizationId,
}: {
  classOptions: { id: string; name: string; parentName?: string | null }[];
  currentOrganizationId: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateOwnStudentClass,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <ActionMessage state={state} />
      <div>
        <label
          htmlFor="student-class"
          className="text-sm font-medium text-slate-700"
        >
          所属班级
        </label>
        <select
          id="student-class"
          name="organizationId"
          defaultValue={currentOrganizationId}
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="">请选择班级</option>
          {classOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.parentName ? `${option.parentName} / ` : ""}
              {option.name}
            </option>
          ))}
        </select>
        <FieldError messages={state.fieldErrors?.organizationId} />
      </div>
      <p className="text-sm leading-6 text-slate-600">
        此处修改的是个人所属行政班级，不会自动调整已选课程、评教任务或历史记录。
      </p>
      <button
        type="submit"
        disabled={pending || classOptions.length === 0}
        className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "保存中..." : "保存班级"}
      </button>
    </form>
  );
}
