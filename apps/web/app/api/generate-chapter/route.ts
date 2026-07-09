import { NextRequest, NextResponse } from "next/server";
import { getEnv, loadPrompt } from "../env";

function cleanAndParseJSON(raw: string) {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  }
  const startObj = cleaned.indexOf("{");
  const startArr = cleaned.indexOf("[");
  let start = -1;
  let end = -1;
  if (startObj !== -1 && (startArr === -1 || startObj < startArr)) {
    start = startObj;
    end = cleaned.lastIndexOf("}");
  } else if (startArr !== -1) {
    start = startArr;
    end = cleaned.lastIndexOf("]");
  }
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  try {
    const { framework, chapterSummary, characterTransitions } = await req.json();

    const apiKey = getEnv("LLM_API_KEY");
    const baseUrl = getEnv("LLM_BASE_URL");
    const model = getEnv("LLM_MODEL") || "qwen3.6-max-preview";

    if (!apiKey || !baseUrl) {
      return NextResponse.json(
        { error: "Missing LLM API Key or Base URL config." },
        { status: 500 }
      );
    }

    const template = loadPrompt("chapter-transition.md");
    if (!template) {
      return NextResponse.json(
        { error: "Failed to load chapter-transition.md prompt template." },
        { status: 500 }
      );
    }

    // Build entering/staying characters context
    const enteringChars: any[] = characterTransitions?.enter || [];
    const leavingIds: string[] = characterTransitions?.leave || [];
    const currentChars: any[] = framework.characters || [];

    const stayingChars = currentChars.filter(
      (c: any) => !leavingIds.includes(c.id) && c.status !== "inactive"
    );

    const enteringContext =
      enteringChars.length > 0
        ? enteringChars.map((c: any) => `- ${c.name} (${c.role}): ${c.description || ""}`).join("\n")
        : "无新登场角色（继续与上一章相同的角色互动）";

    const stayingContext =
      stayingChars.length > 0
        ? stayingChars.map((c: any) => `- ${c.name} (${c.role})`).join("\n")
        : "无";

    const prompt = template
      .replace("{{TITLE}}", framework.title || "")
      .replace("{{GENRE}}", framework.genre || "悬疑奇幻")
      .replace("{{WORLD_VIEW}}", framework.worldView || "")
      .replace("{{CHAPTER_SUMMARY}}", chapterSummary || "")
      .replace("{{ENTERING_CHARACTERS}}", enteringContext)
      .replace("{{STAYING_CHARACTERS}}", stayingContext);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "你是一个小说章节过渡设计师。你只能输出合法的 JSON 格式文本，绝不包含任何前言、后记或 Markdown 标记。",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `LLM API call failed: ${errText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    const parsed = cleanAndParseJSON(rawContent);

    // Normalize newItems to have discovered: false
    if (parsed.newItems && Array.isArray(parsed.newItems)) {
      parsed.newItems = parsed.newItems.map((item: any) => ({
        ...item,
        discovered: false,
      }));
    }

    return NextResponse.json({ result: parsed });
  } catch (e: any) {
    console.error("Chapter generation error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
