# 生产部署与更新指南

本文档用于把智慧评教与反馈平台部署到生产服务器，并支持后续功能持续更新。

## 推荐架构

- Ubuntu 22.04/24.04 服务器
- Docker Engine 与 Docker Compose
- PostgreSQL 16 容器或外部云数据库
- Redis 7 容器，用于登录限流、提交锁和页面缓存
- Next.js 应用容器
- Nginx 反向代理与 HTTPS 证书
- Git 仓库作为生产代码来源

## 首次部署

1. 安装基础软件：

```bash
sudo apt update
sudo apt install -y git ca-certificates curl
```

按 Docker 官方文档安装 Docker Engine 与 Compose 插件。

2. 拉取代码：

```bash
git clone <你的仓库地址>
cd <项目目录>
```

3. 准备生产环境变量：

```bash
cp .env.production.example .env.production
```

修改 `.env.production`：

- `POSTGRES_PASSWORD`：数据库强密码
- `DATABASE_URL`：密码必须与 `POSTGRES_PASSWORD` 一致
- `NEXTAUTH_URL`：生产访问地址，例如 `https://pingjiao.example.com`
- `NEXTAUTH_SECRET`：至少 32 位随机字符串
- `REDIS_URL`：默认可保持 `redis://redis:6379`
- `REDIS_MAXMEMORY`：Redis 缓存最大内存，默认建议 `128mb`

Redis 只用于缓存、登录限流和短时提交锁，不保存业务数据。生产配置默认关闭 Redis RDB/AOF 持久化，并使用 `allkeys-lru` 淘汰策略，避免缓存写盘拖慢后台页面。

可用下面命令生成 `NEXTAUTH_SECRET`：

```bash
openssl rand -base64 32
```

4. 构建并启动：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build postgres redis
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app
```
生产环境
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build --no-cache app
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres redis
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app ./node_modules/.bin/prisma migrate deploy
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app



5. 创建超级管理员：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app \
  npm run create-super-admin -- superadmin@example.edu 'StrongPass123!' '超级管理员'
```

该脚本会创建默认组织，并创建或提升指定邮箱用户为 `SUPER_ADMIN`。密码不会写入日志；首次登录后建议立即修改初始密码。

6. 查看状态：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
```

7. 首次部署后建议清空一次 Redis 缓存：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec redis redis-cli FLUSHDB
```

这只会清除缓存，不会影响 PostgreSQL 业务数据。

## 是否导入演示数据

正式生产环境不要执行：

```bash
npx prisma db seed
```

当前 seed 脚本会清空并重建演示数据，只适合本地或试运行环境。生产初始化管理员账号应通过专门脚本、数据库后台或后续管理功能创建。

生产环境推荐使用：

```bash
npm run create-super-admin -- superadmin@example.edu 'StrongPass123!' '超级管理员'
```

## 后续更新

服务器上执行：

```bash
./scripts/deploy.sh
```

部署脚本会执行：

1. `git pull --ff-only`
2. 重新构建应用镜像
3. 启动或保持 PostgreSQL 和 Redis
4. 执行 `prisma migrate deploy`
5. 重启应用容器
6. 新版本上线后，如出现旧报表或旧页面缓存，可执行一次 `redis-cli FLUSHDB` 清理缓存

如果服务器上的代码已经由 CI/CD 同步，不希望脚本拉代码：

```bash
SKIP_GIT_PULL=1 ./scripts/deploy.sh
```

## 数据库备份

每次生产更新前建议备份：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres teaching_evaluation > backup-$(date +%Y%m%d%H%M%S).sql
```

恢复备份前应先停止应用，避免写入冲突：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml stop app
cat backup.sql | docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres teaching_evaluation
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app
```

如果要连同 Redis 一起重置缓存，可在恢复后执行：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec redis redis-cli FLUSHDB
```

## Nginx 反向代理示例

```nginx
server {
    listen 80;
    server_name pingjiao.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

配置 HTTPS 后，确保 `.env.production` 中的 `NEXTAUTH_URL` 使用 `https://`。

## 常见问题

### 登录回调地址错误

检查：

```bash
grep NEXTAUTH_URL .env.production
```

它必须等于用户浏览器访问的生产域名。

### 更新后页面还是旧版本

执行：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build --no-cache app
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app
```

如果还是显示旧报表或旧任务数据，再清一次 Redis：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec redis redis-cli FLUSHDB
```

### 迁移失败

不要直接删除生产数据库。先备份，再查看：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs postgres
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npx prisma migrate status
```

### 后台变卡或 Redis 报错

先检查 Redis 容器状态：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps redis
docker compose --env-file .env.production -f docker-compose.prod.yml logs redis
```

如果确认只是缓存异常，可清空 Redis 后再观察：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec redis redis-cli FLUSHDB
```

如果日志里出现频繁 `Background AOF rewrite` 或 `append only file rewriting`，说明旧版本 Redis 曾启用 AOF 持久化。当前版本已经把 Redis 调整为纯缓存模式，部署后建议重建 Redis 容器：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml stop app redis
docker compose --env-file .env.production -f docker-compose.prod.yml rm -f redis
docker compose --env-file .env.production -f docker-compose.prod.yml up -d redis
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app
```

旧 Redis 卷只包含缓存数据。确认不再需要后，可以删除旧卷释放空间：

```bash
docker volume ls | grep redis
docker volume rm <redis_volume_name>
```

不要删除 PostgreSQL 卷。


是 VPS 下载 npm 官方源太慢/解析失败导致的
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build --no-cache \
  --build-arg NPM_REGISTRY=https://registry.npmmirror.com \
  app

构建成功再执行以下命令
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres redis

docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app ./node_modules/.bin/prisma migrate deploy

docker compose --env-file .env.production -f docker-compose.prod.yml up -d app


以后正常更新时不要频繁用 --no-cache，否则每次都会重新下载全部 npm 包。通常用：

docker compose --env-file .env.production -f docker-compose.prod.yml build app
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app
只有 Dockerfile 或依赖异常时再用 --no-cache
