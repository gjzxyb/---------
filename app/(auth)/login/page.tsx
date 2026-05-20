import LoginForm from "./LoginForm";

const demoAccounts = [
  "admin@example.edu",
  "teacher@example.edu",
  "student@example.edu",
  "analyst@example.edu",
];

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1fr_420px]">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-sky-700">Teaching quality</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal text-zinc-950 sm:text-5xl">
            智慧评教与反馈平台
          </h1>
          <p className="mt-5 text-lg leading-8 text-zinc-700">
            Sign in to manage evaluation tasks, review teaching feedback, and
            track improvement plans across departments.
          </p>
          <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">
              Demo accounts
            </h2>
            <div className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
              {demoAccounts.map((account) => (
                <span key={account}>{account}</span>
              ))}
            </div>
            <p className="mt-4 text-sm text-zinc-600">
              Password for all demo accounts:{" "}
              <span className="font-medium text-zinc-900">Password123!</span>
            </p>
          </div>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
