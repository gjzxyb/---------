"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/password-field";

const loginFailureMessage = "登录失败，请检查账号和密码";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.ok === true && !result.error) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setError(loginFailureMessage);
    } catch {
      setError(loginFailureMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-white/15 bg-white/[0.08] p-6 shadow-2xl shadow-sky-950/40 backdrop-blur-xl"
    >
      <div>
        <h2 className="text-xl font-semibold text-white">登录</h2>
        <p className="mt-2 text-sm text-slate-300">
          请使用学校账号继续访问。
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-slate-200">
          邮箱
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="mt-2 block w-full rounded-md border border-white/15 bg-white/95 px-3 py-2 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30"
          />
        </label>

        <label className="block text-sm font-medium text-slate-200">
          密码
          <PasswordField
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 block w-full rounded-md border border-white/15 bg-white/95 px-3 py-2 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/30"
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-md border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-100">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 w-full rounded-md bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200"
      >
        {isSubmitting ? "正在登录..." : "登录"}
      </button>
    </form>
  );
}
