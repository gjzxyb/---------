import LoginForm from "./LoginForm";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  return (
    <main className="login-page relative min-h-screen overflow-hidden bg-[#07111f] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(125,211,252,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.08)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="absolute -left-28 top-16 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="absolute left-[18%] top-[20%] h-px w-48 rotate-12 bg-gradient-to-r from-transparent via-sky-300/60 to-transparent" />
      <div className="absolute bottom-[24%] right-[18%] h-px w-64 -rotate-12 bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent" />

      <div className="absolute right-6 top-6 z-20">
        <ThemeToggle />
      </div>

      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-[1fr_420px]">
        <div className="max-w-2xl">
          <p className="inline-flex rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1 text-sm font-medium text-sky-100">
            教学评价与改进平台
          </p>
          <h1 className="mt-5 max-w-xl text-4xl font-semibold tracking-normal text-white sm:text-5xl">
            智慧评教与反馈平台
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
            面向学生评教、教师反馈、管理决策和持续改进闭环，统一沉淀可信、可追溯、可分析的教学质量数据。
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              ["统一认证", "对接学校账号体系"],
              ["评价闭环", "任务、回收、整改贯通"],
              ["数据分析", "多维报表与趋势研判"],
              ["隐私保护", "匿名策略与小样本控制"],
            ].map(([title, detail]) => (
              <div
                key={title}
                className="rounded-md border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-sky-950/20 backdrop-blur"
              >
                <div className="text-sm font-semibold text-sky-100">
                  {title}
                </div>
                <div className="mt-1 text-sm text-slate-400">{detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              评价任务
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              教师成长
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              质量驾驶舱
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              数据治理
            </span>
          </div>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
