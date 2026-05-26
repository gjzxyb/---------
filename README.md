# 智慧评教与反馈平台

这是一个用于课程评价、教学反馈、整改跟踪和管理报表的 Next.js 应用。演示数据覆盖管理员、教师、学生和分析员流程，便于在本地验证核心业务路径。

## 技术栈

- Next.js 16、React 19、App Router
- TypeScript
- Prisma 7、PostgreSQL
- NextAuth.js
- Tailwind CSS
- Vitest、Testing Library
- ESLint

## 本地启动

安装依赖：

```bash
npm install
```

启动本地 PostgreSQL 服务：

```bash
docker compose up -d
```

从示例文件创建本地环境变量：

```bash
cp .env.example .env
```

`.env.example` 中的 `DATABASE_URL` 指向 `docker-compose.yml` 启动的 PostgreSQL 容器。

## Prisma

本项目使用 Prisma 7。Prisma 配置位于 `prisma.config.ts`，其中包含 seed 命令配置。Prisma CLI 命令需要 `DATABASE_URL`，请先复制 `.env.example` 为 `.env`，或在 shell 中显式提供该环境变量。

执行数据库迁移：

```bash
npx prisma migrate dev
```

生成 Prisma Client：

```bash
npx prisma generate
```

写入演示数据：

```bash
npx prisma db seed
```

如果本机没有 Docker 或可访问的 PostgreSQL，迁移、种子数据和部分生产构建步骤可能会失败；配置可访问数据库后再执行这些命令。

## 演示账号

所有演示账号的密码均为 `Password123!`。

| 角色 | 邮箱 |
| --- | --- |
| 管理员 | `admin@example.edu` |
| 教师 | `teacher@example.edu` |
| 学生 | `student@example.edu` |
| 分析员 | `analyst@example.edu` |

## 核心验证流程

1. 使用 `student@example.edu` 登录，在学生评教页面提交一份评教。
2. 使用 `teacher@example.edu` 登录，验证授课班级、评价结果页面、小样本提示和整改计划创建。
3. 使用 `admin@example.edu` 登录，验证以下管理后台页面：
   - 管理看板
   - 模板管理
   - 评教任务
   - 统计报告
   - 基础数据
   - 系统设置

教师结果页会在某个教学班至少有 3 份已提交答卷后，才显示实际得分、题目均分和匿名文本意见。默认种子数据包含 1 份已提交学生答卷和 1 份待提交学生答卷；即使使用 `student@example.edu` 再提交 1 份，样本数也只有 2，仍会触发小样本隐藏。若要验证可见得分和评论，请准备至少 3 份已提交答卷，不需要修改默认 seed 脚本。

## 常用验证命令

```bash
npm test
npm run lint
npx prisma validate
npx tsc --noEmit
npm run build
```

如果 `npx prisma validate` 或 `npm run build` 因缺少 `DATABASE_URL` 失败，请先根据 `.env.example` 创建 `.env`，或在 shell 中提供 `.env.example` 中的 `DATABASE_URL` 后重试。如果 PostgreSQL 未启动或不可访问，依赖数据库的步骤仍可能被本地环境阻断。

## 生产部署

生产部署建议使用 Docker Compose、PostgreSQL、Nginx 和 Git 更新流程。项目已提供：

- `Dockerfile`
- `docker-compose.prod.yml`
- `.env.production.example`
- `scripts/deploy.sh`
- `docs/deployment.md`

完整部署和后续更新步骤见 [生产部署与更新指南](docs/deployment.md)。

首次部署后可创建或提升超级管理员：

```bash
npm run create-super-admin -- superadmin@example.edu 'StrongPass123!' '超级管理员'
```
