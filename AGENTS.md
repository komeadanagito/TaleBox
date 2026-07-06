# TaleBox 项目说明

## 产品方向

TaleBox 是一个手机端 AI 互动小说阅读与创作 App。

用户可以：

- 通过聊天形式与小说角色对话。
- 让 AI 根据用户输入推进剧情。
- 创建自己的小说世界观、角色和剧情。
- 后续导入本地小说文本，并自动生成可互动剧情。
- 后续扩展 AI 生图、AI 生视频、角色语音、剧情短片。

当前阶段不要做社区、好友、陌生人聊天、信息流、评论、点赞、关注、粉丝、排行榜或公开主页。

产品核心不是普通聊天，而是：

```text
AI 角色扮演 + 互动小说 + 剧情状态管理 + 动态 AgentProfile 创建
```

## MVP 原则

第一版必须先跑通一个最小闭环：

```text
创建故事 -> 生成角色 -> 进入聊天 -> AI 推进剧情 -> 保存状态 -> 下次继续
```

优先保证：

- 剧情可以稳定推进。
- 角色不容易崩人设。
- 剧情状态可保存、可恢复、可调试。
- 手机端聊天体验足够顺。
- 用户可以私密创建自己的故事。

第一版暂缓：

- 社区和社交功能。
- 复杂多 Agent 互相讨论。
- 完整小说导入流水线。
- 真实 AI 生图和 AI 生视频。
- 角色语音、支付、额度系统、复杂模型路由。

媒体生成相关的接口和数据库表可以提前预留，但不要进入 MVP 的关键路径。

## 推荐技术选型

### 移动端

- Expo
- React Native
- TypeScript
- Expo Router

用途：

- 对白页。
- 书架页。
- AI 创作页。
- 我的页。
- 聊天详情页。
- 故事创建和导入页面。
- 后续展示 AI 图片、AI 视频、角色卡。

### 后端

- Node.js
- TypeScript
- NestJS

推荐使用 NestJS。原因是项目后续会需要清晰模块边界、依赖注入、队列 Worker、Provider 抽象、Auth、任务系统，以及支付和额度等扩展能力。

### 数据库

- PostgreSQL
- Prisma
- pgvector

PostgreSQL 负责业务数据，pgvector 负责第一阶段的记忆和向量检索。

注意：Prisma 对 PostgreSQL 的 `vector` 这类扩展类型没有完整 ORM 抽象。向量相关 SQL 要封装在 Repository 或 Service 边界内，例如 `MemoryRepository`，通过自定义 migration、raw SQL 或 TypedSQL 使用。

### 缓存、队列和任务

- Redis
- BullMQ

Redis 用于：

- 当前会话缓存。
- 流式输出状态。
- 限流。
- 队列底层存储。

BullMQ 用于：

- 小说导入解析。
- 长文本总结。
- Embedding 生成。
- AgentProfile 批量生成。
- AI 生图/生视频任务占位。

### AI Provider

后端不要直接绑定某一个模型厂商。业务层统一依赖 Provider Interface。

第一阶段可预留的 LLM Provider：

- OpenAI
- Claude
- Gemini
- DeepSeek
- Qwen

后续预留：

- ImageGenerationProvider
- VideoGenerationProvider
- EmbeddingProvider

Provider 接口需要暴露 usage、模型元数据、错误信息、超时策略、结构化输出支持情况、providerRequestId 等信息。

### Agent 技术栈

第一版 Agent 系统使用 TypeScript 自研轻量 Agent Runtime，不使用 CrewAI。CrewAI 主要是 Python 生态，不适合作为本项目的主 Agent 框架。

Agent 相关技术栈：

- NestJS Service
- TypeScript class/function
- Markdown Prompt 模板
- PromptLoader / PromptService
- Zod + JSON Schema
- LLMProvider Interface
- PostgreSQL + pgvector
- Redis
- BullMQ
- LangChain.js
- LangGraph.js

第一版推荐：

```text
自研轻量 Agent Runtime
  -> AgentProfile
  -> packages/prompts/*.md
  -> MemoryService
  -> LLMProvider
  -> Zod 校验
  -> StoryState / story_events 持久化
```

LangChain.js 的定位：

- 只用于 TypeScript / Node.js / NestJS 后端。
- 可用于模型封装、tool calling、结构化输出、流式事件处理。
- 不要让 LangChain 直接拥有 TaleBox 剧情状态。
- 不要把业务层直接耦合到 LangChain 类。

LangGraph.js 的定位：

- 只用于 TypeScript / Node.js / NestJS 后端。
- 后续用于复杂、多步骤、可恢复、可分支的 Agent 工作流。
- 适合小说导入流水线、多步骤故事创建、复杂剧情编排、视频分镜生成等场景。
- 不要在 MVP 一开始为了简单单轮聊天强行引入。
- LangGraph state 只能作为编排状态，不能替代 `story_states` 和 `story_events`。

相关项目本地 skills：

```text
.agents/skills/langchain-ts/SKILL.md
.agents/skills/langgraph-ts/SKILL.md
```

### 结构化输出

- Zod
- JSON Schema

所有会影响数据库状态的 AI 输出都必须先校验，再写入业务表。

### 文件存储和部署

文件存储可选：

- S3
- Cloudflare R2
- 阿里云 OSS
- 腾讯云 COS

部署建议：

- Docker
- 本地开发使用 Docker Compose
- 生产环境使用云服务器或托管容器服务

## 整体架构

```text
Mobile App
  -> API Server
  -> Story Orchestrator
  -> Character Agent Runtime
  -> Memory System
  -> LLM Provider
  -> State Updater
  -> Database / Vector Store / Redis / Queue
```

后端建议从一开始拆成两个进程：

```text
server-api
  - HTTP API
  - 登录鉴权
  - story/session/chat 接口
  - 流式聊天响应

server-worker
  - BullMQ 消费者
  - 小说导入流水线
  - 总结任务
  - Embedding 任务
  - 媒体生成任务
```

不要在请求处理器里执行长耗时 AI 任务、CPU 密集任务或大文本处理任务。

## 目标目录结构

```text
ai-novel-app/
├── AGENTS.md
├── apps/
│   ├── mobile/
│   │   ├── app/
│   │   │   ├── (tabs)/
│   │   │   │   ├── dialogue.tsx
│   │   │   │   ├── bookshelf.tsx
│   │   │   │   ├── creation.tsx
│   │   │   │   └── profile.tsx
│   │   │   ├── chat/
│   │   │   │   └── [sessionId].tsx
│   │   │   ├── story/
│   │   │   │   └── [storyId].tsx
│   │   │   └── creation/
│   │   │       ├── create-story.tsx
│   │   │       ├── import-novel.tsx
│   │   │       └── generation-task.tsx
│   │   ├── components/
│   │   │   ├── StoryCard.tsx
│   │   │   ├── ChatBubble.tsx
│   │   │   ├── CharacterAvatar.tsx
│   │   │   ├── MediaCard.tsx
│   │   │   ├── BottomTabBar.tsx
│   │   │   └── RoundedButton.tsx
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── chat.service.ts
│   │   │   ├── story.service.ts
│   │   │   ├── creation.service.ts
│   │   │   └── media.service.ts
│   │   ├── stores/
│   │   ├── hooks/
│   │   └── theme/
│   │       ├── colors.ts
│   │       ├── radius.ts
│   │       ├── spacing.ts
│   │       └── typography.ts
│   │
│   └── server/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── stories/
│       │   │   ├── sessions/
│       │   │   ├── messages/
│       │   │   ├── agents/
│       │   │   ├── story-engine/
│       │   │   ├── memory/
│       │   │   ├── creation/
│       │   │   ├── import/
│       │   │   ├── media/
│       │   │   └── tasks/
│       │   ├── providers/
│       │   │   ├── llm/
│       │   │   ├── image/
│       │   │   ├── video/
│       │   │   └── embedding/
│       │   ├── schemas/
│       │   ├── common/
│       │   │   └── prompt-loader/
│       │   └── prisma/
│       │       └── schema.prisma
│       └── package.json
│
├── packages/
│   ├── shared/
│   │   ├── types/
│   │   ├── constants/
│   │   └── schemas/
│   └── prompts/
│       ├── story-orchestrator.md
│       ├── character-agent.md
│       ├── creation-agent.md
│       ├── memory-summary.md
│       ├── state-updater.md
│       ├── novel-import.md
│       ├── image-generation.md
│       └── video-generation.md
│
├── docs/
│   ├── pen_file/
│   │   └── talebox.pen
│   └── superpowers/
│
├── docker-compose.yml
├── package.json
└── README.md
```

## 后端模块职责

### Auth 模块

负责登录、身份识别、Token 和当前用户上下文。

MVP 可以使用邮箱密码、手机号登录或匿名设备登录。第一阶段不要做复杂权限系统。

### Stories 模块

负责故事基础信息：

- 标题。
- 描述。
- 类型。
- 世界设定。
- 封面资源。
- 所属用户。

### Sessions 模块

负责用户对某个故事的一次阅读和聊天进度。

一个故事可以有多个 session。session 指向当前章节、当前场景和当前剧情状态。

### Messages 模块

负责保存用户、角色、旁白和系统消息。

消息必须关联到 session。建议同时关联 `turn_id`，这样一次用户输入和所有 AI 输出可以归为一个回合。

### Agents 模块

负责保存和加载 `AgentProfile`。

不要在源码里硬编码具体角色。角色应该由创建流程或导入流程生成，再作为数据保存。

运行时 Agent 的本质是：

```text
Agent = Profile + Prompt + Memory + Tools + Runtime
```

建议目录：

```text
apps/server/src/modules/agents/
├── agent-factory.service.ts
├── character-agent.runtime.ts
├── creation-agent.service.ts
├── memory-agent.service.ts
└── state-updater.service.ts
```

如果后续引入 LangChain.js 或 LangGraph.js，把适配层放在后端内部，不要让 Controller、移动端或数据库 schema 直接依赖第三方 Agent 框架：

```text
apps/server/src/modules/agents/adapters/
├── langchain/
└── langgraph/
```

### Story Engine 模块

负责剧情回合编排。

职责：

- 读取当前 StoryState。
- 加载当前 Scene 和 activeCharacters。
- 检索相关记忆。
- 规划本轮回复。
- 生成角色对白和旁白。
- 生成并校验 statePatch。
- 保存消息和状态变化。

### Memory 模块

MVP 的记忆系统可以保持简单：

- 最近消息窗口。
- 当前 session 总结。
- 少量长期记忆。

长期记忆后续再接 Embedding 和 pgvector。第一版不要把记忆系统做得过重。

### Creation 模块

负责根据用户灵感创建故事。

需要生成：

- 故事标题。
- 世界设定。
- 核心角色。
- AgentProfiles。
- 第一幕场景。
- 初始 StoryState。

### Import 模块

为 TXT/EPUB 导入预留。

导入不要进入第一版 MVP 的关键路径。等基础故事创建和聊天稳定后再实现。

### Media 模块

为图片、视频、音频生成预留。

第一阶段可以先建接口和数据库表，但真实媒体 Provider 放到后续阶段接入。

### Tasks 模块

负责任务创建、队列生产者、Worker、任务状态、重试和任务结果查询。

## 核心数据模型

第一阶段最少需要这些表：

- `users`
- `stories`
- `story_sessions`
- `messages`
- `story_states`
- `story_events`
- `agent_profiles`
- `agent_memories`
- `story_scenes`
- `llm_runs`
- `usage_records`

媒体生成预留表：

- `media_tasks`
- `media_assets`
- `character_visual_profiles`
- `story_visual_styles`

### StoryState 设计原则

不要只存一个可变的 JSON blob。

建议使用：

- `story_states`：保存当前最新状态快照。
- `story_events`：保存每一轮事件和 statePatch。
- `state_version`：支持状态结构演进。
- `turn_id`：把一次用户输入和对应 AI 输出归组。

这样后续可以回放、调试、回滚和分析 AI 行为。

## 聊天回合流程

推荐流程：

```text
用户发送消息
  -> API 校验请求和 idempotency key
  -> 创建 chat turn
  -> 保存用户消息
  -> 加载 StoryState
  -> 加载 Scene
  -> 加载 active AgentProfiles
  -> 检索记忆
  -> StoryOrchestrator 生成回复计划
  -> CharacterAgentRuntime/Narrator 生成消息
  -> 校验结构化 AI 输出
  -> 流式返回给移动端
  -> 保存 AI 消息
  -> 应用 statePatch
  -> 保存 story_event
  -> 提取 memory candidates
  -> 记录 LLM usage
```

聊天接口应该支持流式输出。移动端发送消息时要带 `clientMessageId` 这类幂等键，避免网络重试导致重复生成剧情。

## AI 输出协议

会改变剧情状态的 AI 输出必须是结构化数据，并且必须校验。

示例：

```ts
type AgentTurnOutput = {
  messages: Array<{
    role: "character" | "narrator";
    characterId?: string;
    content: string;
  }>;
  statePatch: Record<string, unknown>;
  memoryCandidates: Array<{
    type: "story_fact" | "character_memory" | "user_claim" | "world_lore" | "relationship_event";
    content: string;
    importance: number;
  }>;
  nextSceneHint?: string;
  safetyFlags?: string[];
};
```

如果校验失败，先修复或重试，不要直接修改持久化状态。

## Prompt 管理原则

Prompt 必须从业务代码中分离出来，使用独立 Markdown 文件管理。

Prompt 文件统一放在：

```text
packages/prompts/
```

示例：

```text
packages/prompts/story-orchestrator.md
packages/prompts/character-agent.md
packages/prompts/creation-agent.md
packages/prompts/memory-summary.md
packages/prompts/state-updater.md
packages/prompts/novel-import.md
packages/prompts/image-generation.md
packages/prompts/video-generation.md
```

不要这样做：

```ts
export const CHARACTER_AGENT_PROMPT = `你现在要扮演...`;
```

也不要把长 prompt 直接写在 Service、Controller、Provider、Agent Runtime 或测试文件里。

后端应通过 `PromptLoader` 或 `PromptService` 读取 Markdown 模板，再传入变量渲染：

```text
Prompt Markdown
  -> PromptLoader
  -> template variables
  -> rendered prompt
  -> LLM Provider
```

Prompt 模板建议包含：

- 角色说明。
- 输入变量说明。
- 输出格式要求。
- 约束规则。
- 失败处理规则。
- 示例输入和示例输出。

Prompt 文件要版本化。涉及线上行为变化时，应该记录 prompt 名称、版本、渲染后的摘要、模型名和 `llm_run_id`，方便回放和调试。

## Provider 接口原则

LLM Provider 应支持：

- 非流式生成。
- 流式生成。
- 结构化输出。
- 模型元数据。
- Token 使用量。
- Provider 请求 ID。
- 超时和重试处理。
- 统一错误格式。

图片和视频 Provider 应该创建任务，并提供任务状态查询。不要让 API 请求一直阻塞等待长时间媒体生成。

## API 方向

MVP 建议接口：

```text
POST /api/auth/login
GET  /api/me

POST /api/stories/create
GET  /api/stories
GET  /api/stories/:storyId

POST /api/sessions
GET  /api/sessions/:sessionId

POST /api/chat/send
GET  /api/chat/:sessionId/messages

GET  /api/tasks/:taskId
```

后续预留接口：

```text
POST /api/stories/import
POST /api/media/image/generate
POST /api/media/video/generate
```

## 移动端 UI 方向

当前设计源文件：

```text
docs/pen_file/talebox.pen
```

App 保留四个 Tab：

- 对白
- 书架
- AI 创作
- 我的

UI 原则：

- 聊天优先，故事优先。
- 私密阅读和私密创作，不做社交发现。
- 不要信息流、粉丝、公开排行或评论区。
- 视觉上保持圆润、安静、沉浸。
- 主要操作要清晰、容易触达。
- 注意安全区和底部 Tab 间距。
- 重复出现的行、卡片、头像、按钮要做成可复用组件。

当前设计实现前需要注意：

- AI 创作页有说明文字被裁剪。
- 多个 divider 是 `0x0`，视觉上无效。
- `.pen` 文件当前没有共享变量和可复用组件。
- 对白页应该更像聊天会话列表，而不是营销式 Hero 页面。
- MVP 还需要补充聊天详情页、创建故事页、导入任务页和故事详情页。

## 推荐开发顺序

第一阶段建议按这个顺序推进：

1. 搭建 monorepo 结构。
2. 搭建 Expo 移动端。
3. 搭建 NestJS API Server。
4. 本地接入 PostgreSQL、Prisma、Redis、BullMQ。
5. 建立 users、stories、sessions、messages、states、events、agent_profiles 等核心 schema。
6. 建立 `packages/prompts/`，把 CreationAgent、StoryOrchestrator、CharacterAgent、StateUpdater 等 prompt 拆成独立 `.md` 文件。
7. 实现 `PromptLoader` 或 `PromptService`，从 Markdown 模板读取并渲染 prompt。
8. 用 CreationAgent prompt 实现从灵感创建故事。
9. 实现带结构化输出校验的聊天回合 API。
10. 实现 StoryState patch 和 story_events 记录。
11. 实现简单记忆总结。
12. 实现对白 Tab 和聊天详情页。
13. 实现书架 Tab 和 AI 创作 Tab。
14. 加入媒体任务表和 Provider 接口占位。
15. 后续加入小说导入流水线。
16. 后续接入真实 AI 生图和 AI 生视频。

## 工程规则

- MVP 代码保持简单、可观察、可调试。
- Agent 代码使用 TypeScript，不使用 Python Agent 框架或 CrewAI。
- 自研轻量 Agent Runtime 不够用之前，不要引入复杂 Agent 框架。
- LangChain.js 只能作为后端模型、工具和结构化输出辅助层，不要接管业务状态。
- LangGraph.js 只在需要多步骤、可恢复、可分支编排时引入，不要替代 `story_states`、`story_events` 或 BullMQ。
- Prompt 模板必须使用独立 `.md` 文件，不要硬编码在 `.ts` 文件或业务代码里。
- Prompt 模板要版本化，并通过 `PromptLoader` 或 `PromptService` 读取。
- 每次 LLM 调用都记录到 `llm_runs`。
- 从第一版开始记录 usage 和成本。
- AI JSON 写入业务表前必须校验。
- 长耗时任务必须放到 Worker。
- 向量检索必须封装在 Service 或 Repository 边界内。
- 不要在源码里写死某个具体小说角色。
- 不要添加社交功能，除非后续明确要求。
