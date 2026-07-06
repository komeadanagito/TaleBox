---
name: langchain-ts
description: Use when adding or reviewing LangChain.js usage in a TypeScript or NestJS backend, including agents, tools, model wrappers, structured output, streaming, or provider integration.
---

# LangChain.js TypeScript

Use this skill for LangChain.js in this project. Do not use Python examples or CrewAI patterns.

## Project Rules

- Use TypeScript only.
- Keep LangChain code in `apps/server`, not in the Expo mobile app.
- Do not hard-code prompts in `.ts` files. Load prompt Markdown from `packages/prompts/*.md`.
- Keep project business code behind local interfaces such as `LLMProvider`, `PromptService`, `MemoryService`, and `AgentRuntime`.
- Prefer the project's lightweight Agent Runtime for MVP. Add LangChain only when its model/tool abstractions clearly reduce complexity.
- Record each model call in `llm_runs` and usage in `usage_records`.

## Packages

Official TypeScript install packages:

```bash
npm install langchain @langchain/core
```

Provider packages are separate:

```bash
npm install @langchain/openai
npm install @langchain/anthropic
```

Use the repo package manager when it exists. Do not install globally.

LangChain JavaScript currently requires Node.js 22+ according to the official install docs.

## Good Fit

Use LangChain.js for:

- Tool definition and tool calling.
- Provider-specific chat model wrappers.
- Structured output helpers.
- Streaming/event handling when simpler local wrappers become repetitive.
- Small agent harnesses where `createAgent` is enough.

Avoid LangChain.js for:

- Persisting TaleBox story state directly.
- Replacing `story_states` and `story_events`.
- Hiding important plot/state transitions inside opaque chains.
- Long prompts embedded in source code.

## Recommended Integration Shape

```text
NestJS Service
  -> PromptService loads packages/prompts/*.md
  -> MemoryService retrieves context
  -> LangChain model/tool layer
  -> Zod validates output
  -> StoryEngine persists messages/events/state
```

Keep LangChain at the model/tool execution layer. The Story Engine owns TaleBox state transitions.

## Tool Pattern

Use Zod schemas for tools and structured inputs:

```ts
import { tool } from "langchain";
import { z } from "zod";

export const inspectStoryStateTool = tool(
  async (input) => {
    return JSON.stringify({ sceneId: input.sceneId });
  },
  {
    name: "inspect_story_state",
    description: "Read a TaleBox story state snapshot by scene id.",
    schema: z.object({
      sceneId: z.string(),
    }),
  },
);
```

## Common Mistakes

- Do not copy Python LangChain code into this repo.
- Do not couple controllers directly to LangChain classes.
- Do not skip Zod validation just because LangChain returns structured-looking data.
- Do not put API keys or provider selection in prompt files.
- Do not let tool calls mutate story state without going through Story Engine services.

