# TaleBox

TaleBox 是一个专注于手机端 AI 互动小说阅读与创作的开源平台。用户可以通过对话的形式与小说角色实时互动、以聊天的交互方式共同推进剧情，并支持私密化创建属于自己的小说世界观、角色和剧情故事。

---

## 🌟 核心特性

- 💬 **AI 角色对话**：以极简、沉浸式的聊天交互与故事中的角色深度对话。
- 🔮 **动态剧情演进**：AI 根据用户的对话选择和输入，实时规划并稳定推进小说剧情。
- 🌍 **开放世界与创作**：支持用户自定义世界观、世界设定、核心角色以及第一幕场景。
- 📚 **本地小说互动化（规划中）**：支持导入本地的 TXT/EPUB 格式小说，并由 AI 自动生成可分支互动的剧情线。
- 🎨 **多媒体生成预留**：内置 AI 绘图、AI 视频生成、角色语音（TTS）等媒体任务生成流程的接口设计。

---

## 🏗️ 架构设计

TaleBox 采用现代化、高性能的 Monorepo 项目架构，服务端与客户端均采用 TypeScript 技术栈，保障代码类型安全与高复用性。

```
TaleBox (Monorepo)
├── apps/
│   ├── mobile/      # 移动客户端 (Expo + React Native)
│   └── server/      # 服务端 API & 异步任务 Worker (NestJS)
└── packages/
    ├── shared/      # 前后端共用的类型定义、常量及校验 Schema
    └── prompts/     # 独立版本控制的 Markdown 格式 AI Prompt 提示词模板
```

### 聊天与状态回合流程
```
用户输入 ──> 校验与幂等处理 ──> 载入 StoryState & 活跃角色 ──> Memory 检索
                                                                  │
 📝 状态回滚与调试 <── 应用 statePatch <── 校验结构化输出 <── StoryOrchestrator 规划
```

---

## 🛠️ 技术选型

### 📱 移动端 (Mobile App)
- **框架**：[Expo](https://expo.dev/) / [React Native](https://reactnative.dev/)
- **路由**：Expo Router (基于文件系统的 React Native 路由系统)
- **状态管理**：Zustand / React Context
- **设计风格**：圆润、安静、沉浸，注重手机端单手操作的触达体验

### ⚙️ 后端服务 (Backend Server)
- **核心框架**：[NestJS](https://nestjs.com/) (提供清晰的模块化边界与依赖注入)
- **数据库**：[PostgreSQL](https://www.postgresql.org/) + [Prisma ORM](https://www.prisma.io/)
- **向量存储**：[pgvector](https://github.com/pgvector/pgvector) (负责长期记忆与背景设定的相关性检索)
- **缓存与队列**：[Redis](https://redis.io/) + [BullMQ](https://bullmq.io/) (处理长耗时的媒体生成、文本总结及长文本导入任务)
- **AI 编排**：自研轻量级 Agent Runtime (对 LLM 调用实施 Zod/JSON Schema 强校验，保障输出的结构化)

---

## 🚀 快速开始

*(注意：当前项目处于初期开发阶段)*

### 1. 克隆并安装依赖
```bash
git clone https://github.com/komeadanagito/TaleBox.git
cd TaleBox
npm install
```

### 2. 运行移动端
```bash
cd apps/mobile
npm run start
```

### 3. 运行服务端
```bash
cd apps/server
# 启动本地 PostgreSQL & Redis 依赖
docker-compose up -d
# 运行 API 服务
npm run start:dev
```

---

## 📜 开源协议

本项目采用 **[Apache License 2.0](LICENSE)** 协议开源。
