import { NextRequest, NextResponse } from "next/server";
import { getEnv, loadPrompt } from "../../env";
import { normalizeTurn, parseModelJSON } from "../helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const required = ["novelTitle", "chapterTitle", "sourceContext", "roleName", "chapterGoal", "currentBeat", "completedBeats", "recentHistory", "selectedChoice"] as const;
    for (const field of required) if (typeof body[field] !== "string") return NextResponse.json({ error: `缺少 ${field}` }, { status: 400 });
    const apiKey = getEnv("LLM_API_KEY");
    const baseUrl = getEnv("LLM_BASE_URL");
    const model = getEnv("LLM_MODEL") || "qwen3.6-max-preview";
    if (!apiKey || !baseUrl) return NextResponse.json({ error: "缺少 LLM 配置" }, { status: 500 });
    const prompt = loadPrompt("novel-import-turn.md")
      .replace("{{NOVEL_TITLE}}", body.novelTitle)
      .replace("{{CHAPTER_TITLE}}", body.chapterTitle)
      .replace("{{ROLE_NAME}}", body.roleName)
      .replace("{{CHAPTER_GOAL}}", body.chapterGoal)
      .replace("{{CURRENT_BEAT}}", body.currentBeat)
      .replace("{{COMPLETED_BEATS}}", body.completedBeats)
      .replace("{{RECENT_HISTORY}}", body.recentHistory)
      .replace("{{SELECTED_CHOICE}}", body.selectedChoice)
      .replace("{{CHAPTER_CONTENT}}", body.sourceContext.slice(0, 12000));
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.55, messages: [{ role: "system", content: "你是忠于原著的互动小说编排器，只输出合法JSON。" }, { role: "user", content: prompt }] }),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.error?.message || "剧情推进失败" }, { status: response.status });
    return NextResponse.json({ result: normalizeTurn(parseModelJSON(data.choices?.[0]?.message?.content || "")) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "剧情推进失败" }, { status: 500 });
  }
}
