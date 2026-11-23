# 类似项目检索与采用说明

在实现寻页前，检索并对比了 GitHub 上公开的阅读、写作和内容管理项目。以下项目只用于学习架构与业务拆分，没有复制其源代码。

## 1. Chevoink 启创墨域

仓库：<https://github.com/Xcy8010/Chevoink>

特点：

- React Web、Android Capacitor 和 Windows 客户端共用业务 API。
- Express API + PostgreSQL，权限、作品、社区、订单和运营功能按领域拆分。
- 移动端将发现、阅读、创作、社区和书架分开组织。
- 使用 nginx、HTTPS、CSP 和受管文件存储处理生产安全。

对寻页的影响：

- 采用单业务 API 同时服务手机端与 Web 管理端的思路。
- 保留发现、阅读、创作和个人中心的核心移动信息架构。
- 采用更严格的安全响应头和角色服务端校验。
- 没有照搬其重型 AI 创作和桌面端能力，避免比赛项目失焦。

## 2. fiction_cos

仓库：<https://github.com/Fankekeke/fiction_cos>

特点：

- Spring Boot + Vue + MySQL + Redis。
- 明确区分管理员、作者、读者三类角色。
- 覆盖书籍、章节、审核、会员订单、会员价格、主题、评论、关注、阅读排行和统计。
- “作者提交 → 平台审核 → 读者消费”的领域流程与寻页非常接近。

对寻页的影响：

- 借鉴三角色的权限分层。
- 把作品和章节审核设计成明确状态机。
- 将余额充值、会员订单、章节购买和打赏拆成独立记录。
- 因为 Spring Boot + MySQL + Redis 对课程现场过重，没有复现其技术栈，而以 Node.js + SQLite 实现同样的业务闭环。

## 3. bookshop 寻书移动端

仓库：<https://github.com/Acllex/bookshop>

特点：

- Vue 单页移动端，按页面和 API 模块拆分。
- 使用底部导航、分类、搜索、商品详情和个人中心形成移动端体验。

对寻页的影响：

- 参考了“固定手机壳层 + 内容滚动 + 底部主导航”的结构。
- 保留移动端先服务核心流程的设计，不把 Web 后台表格硬塞进手机。
- 使用原生 CSS 重新实现视觉系统，避免继承旧项目年代感和第三方 UI 依赖。

## 4. 最终取舍

| 维度 | 重型开源方案 | 寻页采用方案 |
| --- | --- | --- |
| 后端 | Spring Boot / Express + PostgreSQL | Node.js 原生 HTTP |
| 数据库 | MySQL / PostgreSQL + Redis | Node.js 内置 SQLite |
| 前端 | Vue/React 工程链 | 零依赖响应式 PWA |
| 启动 | 安装运行时、数据库、缓存、迁移 | `node server/index.js` |
| 演示稳定性 | 依赖多，现场环境风险高 | 单进程、单文件数据库、断网可运行 |
| 可扩展性 | 大型团队友好 | API 分层清晰，可替换数据库和前端框架 |

寻页优先解决比赛场景中的“可运行、可演示、业务闭环完整”，同时保留从 SQLite 迁移至 PostgreSQL、从 PWA 包装成 Capacitor App 的路径。

