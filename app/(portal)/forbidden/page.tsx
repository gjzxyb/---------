import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-zinc-950">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-red-700">403 Forbidden</p>
        <h1 className="mt-3 text-2xl font-semibold">无权限访问</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Your account does not have permission to view this page.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
          >
            Login
          </Link>
        </div>
      </section>
    </main>
  );
}
