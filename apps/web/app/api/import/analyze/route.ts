import { NextRequest, NextResponse } from "next/server";
import { getEnv, loadPrompt } from "../../env";
import { normalizeAnalysis, parseModelJSON } from "../helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const novelTitle = typeof body.novelTitle === "string" ? body.novelTitle : "未命名小说";
    const chapterTitle = typeof body.chapterTitle === "string" ? body.chapterTitle : "正文";
    const chapterContent = typeof body.chapterContent === "string" ? body.chapterContent : "";
    const previousSummary = typeof body.previousSummary === "string" ? body.previousSummary : "无";
    if (chapterContent.length < 50) return NextResponse.json({ error: "章节正文过短" }, { status: 400 });
    const apiKey = getEnv("LLM_API_KEY");
    const baseUrl = getEnv("LLM_BASE_URL");
    const model = getEnv("LLM_MODEL") || "qwen3.6-max-preview";
    if (!apiKey || !baseUrl) return NextResponse.json({ error: "缺少 LLM 配置" }, { status: 500 });
    const template = loadPrompt("novel-import.md");
    const rawParagraphs = chapterContent.split(/\n+/).map((text: string) => text.trim()).filter(Boolean);
    const paragraphIds = rawParagraphs.map((_: string, index: number) => `p-${String(index + 1).padStart(4, "0")}`);
    const taggedContent = rawParagraphs.map((text: string, index: number) => `[${paragraphIds[index]}] ${text}`).join("\n").slice(0, 60000);
    const includedParagraphIds = paragraphIds.slice(0, taggedContent.split("\n").length);
    const prompt = template
      .replace("{{NOVEL_TITLE}}", novelTitle)
      .replace("{{CHAPTER_TITLE}}", chapterTitle)
      .replace("{{PREVIOUS_SUMMARY}}", previousSummary)
      .replace("{{CHAPTER_CONTENT}}", taggedContent);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.35, messages: [{ role: "system", content: "你是严谨的小说章节结构分析器，只输出合法JSON。" }, { role: "user", content: prompt }] }),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.error?.message || "章节分析失败" }, { status: response.status });
    return NextResponse.json({ result: normalizeAnalysis(parseModelJSON(data.choices?.[0]?.message?.content || ""), includedParagraphIds) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "章节分析失败" }, { status: 500 });
  }
}
