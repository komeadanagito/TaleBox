import { NextRequest } from "next/server";
import { getEnv, loadPrompt } from "../env";

export const runtime = "nodejs"; // ensure nodejs environment for standard file reads

export async function POST(req: NextRequest) {
  try {
    const { framework, messages, userInput, tone } = await req.json();
    
    const apiKey = getEnv("LLM_API_KEY");
    const baseUrl = getEnv("LLM_BASE_URL");
    const model = getEnv("LLM_MODEL") || "qwen3.6-max-preview";
    
    if (!apiKey || !baseUrl) {
      return new Response("Missing LLM API Key or Base URL config in environment.", { status: 500 });
    }

    // Format characters list with their settings for context
    const charsList = framework.characters.map((c: any) => 
      `- ID: ${c.id}, 姓名: ${c.name}, 标签/身份: ${c.role}\n  人设与秘密: ${c.persona}\n  台词风格: ${c.speechStyle}\n  好感度: ${c.relationship ?? 50}`
    ).join("\n");
    const itemsList = framework.items.map((i: any) => `- 【${i.name}】: ${i.description}`).join("\n");
    
    // Format dialogue history
    const historyContext = messages.map((m: any) => {
      if (m.role === "narrator") {
        return `[旁白]: ${m.content}`;
      } else if (m.role === "user") {
        return `[主角抉择/行为]: ${m.content}`;
      } else {
        return `[角色 ${m.characterName}]: ${m.content}`;
      }
    }).join("\n");

    let orchestratorTemplate = loadPrompt("story-orchestrator.md");
    if (!orchestratorTemplate) {
      return new Response("Failed to load story-orchestrator.md prompt template.", { status: 500 });
    }

    const prompt = orchestratorTemplate
      .replace("{{TITLE}}", framework.title)
      .replace("{{GENRE}}", framework.genre || "自定义")
      .replace("{{WORLD_VIEW}}", framework.worldView)
      .replace("{{SCENE_LOCATION}}", framework.scenes[0]?.location || "")
      .replace("{{SCENE_SUMMARY}}", framework.scenes[0]?.summary || "")
      .replace("{{CHARACTER_LIST}}", charsList)
      .replace("{{ITEM_LIST}}", itemsList)
      .replace("{{HISTORY}}", historyContext)
      .replace("{{USER_INPUT}}", userInput)
      .replace("{{TONE}}", tone || "普通口吻");

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "你是一个互动小说编排导演。你必须严格按照要求的格式输出场景正文，以及附带的 [SUGGESTIONS] 与 [STATE_PATCH] 数据。" },
          { role: "user", content: prompt }
        ],
        stream: true,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(`LLM API call failed: ${errText}`, { status: response.status });
    }

    // Proxy the stream chunk-by-chunk directly to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine || !cleanLine.startsWith("data:")) continue;
            
            const dataStr = cleanLine.substring(5).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(dataStr);
              const text = parsed.choices?.[0]?.delta?.content || "";
              if (text) {
                controller.enqueue(new TextEncoder().encode(text));
              }
            } catch (e) {
              // Ignore parse errors on incomplete lines
            }
          }
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
