---
name: langgraph-ts
description: Use when adding or reviewing LangGraph.js usage in a TypeScript or NestJS backend, especially for stateful multi-step agent workflows, deterministic graph orchestration, streaming, persistence, retries, or human-in-the-loop flows.
---

# LangGraph.js TypeScript

Use this skill for LangGraph.js in this project. Do not use Python LangGraph examples.

## Project Rules

- Use TypeScript only.
- Keep LangGraph code in `apps/server`, not in the Expo mobile app.
- Do not use LangGraph as the first MVP dependency unless the workflow has multiple durable steps.
- Do not hard-code prompts in graph nodes. Load Markdown templates from `packages/prompts/*.md`.
- TaleBox canonical state lives in PostgreSQL: `story_states`, `story_events`, `messages`, and `agent_profiles`.
- LangGraph state is orchestration state. It must not become the only source of story truth.

## Packages

Official TypeScript install packages:

```bash
npm install @langchain/langgraph @langchain/core
```

LangGraph often uses LangChain model/tool components, installed separately:

```bash
npm install langchain
```

Use the repo package manager when it exists. Do not install globally.

## When To Use

Use LangGraph.js when a TaleBox workflow needs:

- Multiple explicit steps with clear transitions.
- Durable or resumable execution.
- Streaming graph events.
- Human approval or interruption points.
- Branching, retries, or rollback.
- Long-running stateful agent orchestration.

Good later candidates:

- Novel import pipeline orchestration.
- Multi-step story creation.
- Complex chat turn planning with retries.
- Director/shot-list/video generation workflows.

Avoid LangGraph.js for:

- A simple one-call CharacterAgent response.
- Replacing BullMQ worker queues.
- Replacing database persistence.
- Hiding business state changes inside graph internals.

## Recommended Integration Shape

```text
NestJS StoryEngineService
  -> build/invoke LangGraph workflow
  -> graph nodes call local services
  -> nodes return typed partial state
  -> final output validated by Zod
  -> StoryEngine persists statePatch and story_event
```

Graph nodes should call local services such as:

- `PromptService`
- `LLMProvider`
- `MemoryService`
- `StateUpdaterService`
- `MediaTaskService`

## Minimal TypeScript Shape

```ts
import {
  StateSchema,
  MessagesValue,
  type GraphNode,
  StateGraph,
  START,
  END,
} from "@langchain/langgraph";

const State = new StateSchema({
  messages: MessagesValue,
});

const storyNode: GraphNode<typeof State> = async (state) => {
  return {
    messages: [
      ...state.messages,
      { role: "ai", content: "下一段剧情..." },
    ],
  };
};

export const graph = new StateGraph(State)
  .addNode("story", storyNode)
  .addEdge(START, "story")
  .addEdge("story", END)
  .compile();
```

Adapt examples to the installed LangGraph.js version and verify against official docs before final implementation.

## Common Mistakes

- Do not port Python decorators or Python state annotations into TypeScript.
- Do not make graph node names business secrets or prompt text.
- Do not mutate database state in multiple graph nodes without an explicit persistence boundary.
- Do not skip idempotency. Chat turns should still use `clientMessageId` or an equivalent key.
- Do not use graph memory as a substitute for TaleBox `story_events`.

