"use client";

import type { ChangeEventHandler } from "react";
import { useState } from "react";

type PasswordFieldProps = {
  autoComplete?: string;
  className?: string;
  id?: string;
  name?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  required?: boolean;
  value?: string;
};

export function PasswordField({
  autoComplete,
  className,
  id = "password",
  name = "password",
  onChange,
  required = true,
  value,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        autoComplete={autoComplete}
        id={id}
        name={name}
        onChange={onChange}
        required={required}
        type={visible ? "text" : "password"}
        value={value}
        className={`${className ?? ""} pr-20`}
      />
      <button
        type="button"
        aria-label={visible ? "隐藏密码" : "显示密码"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-100 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-sky-400"
      >
        {visible ? "隐藏" : "显示"}
      </button>
    </div>
  );
}
