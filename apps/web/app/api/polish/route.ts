import { NextRequest } from "next/server";
import { getEnv, loadPrompt } from "../env";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { genre, text } = await req.json();
    
    const apiKey = getEnv("LLM_API_KEY");
    const baseUrl = getEnv("LLM_BASE_URL");
    const model = getEnv("LLM_MODEL") || "qwen3.6-max-preview";
    
    if (!apiKey || !baseUrl) {
      return new Response("Missing LLM API Key or Base URL config in environment.", { status: 500 });
    }
    
    let promptTemplate = loadPrompt("polish-agent.md");
    if (!promptTemplate) {
      promptTemplate = `你是一个金牌小说主编和AI创意助理。请将用户输入的粗糙小说灵感，结合选定的小说题材【{{GENRE}}】，润色并扩写成一段约 150-250 字、具有极强画面感、叙事张力和沉浸感的精美小说开篇引子（灵感原石）。请直接输出润色后的文本，不要带有任何解释、旁白或标记。\n\n用户原始想法：{{TEXT}}`;
    }

    const prompt = promptTemplate
      .replace("{{GENRE}}", genre)
      .replace("{{TEXT}}", text);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "你是一个专业的创意作家，只输出小说内容，不说话，也不输出额外解释。" },
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
              const textChunk = parsed.choices?.[0]?.delta?.content || "";
              if (textChunk) {
                controller.enqueue(new TextEncoder().encode(textChunk));
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
