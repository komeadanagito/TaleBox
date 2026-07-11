import { NextRequest, NextResponse } from "next/server";
import { createParagraphChunks } from "../../../../lib/import-novel/compiler/chunker";
import { CHUNK_ANALYSIS_CONCURRENCY } from "../../../../lib/import-novel/compiler/constants";
import { serializeChapterSource, sha256 } from "../../../../lib/import-novel/compiler/hash";
import { mergeChapterPlan } from "../../../../lib/import-novel/compiler/merger";
import { createSourceOnlyChunkPlan } from "../../../../lib/import-novel/compiler/source-only";
import { assertChapterPlan } from "../../../../lib/import-novel/compiler/validator";
import { getEnv, loadPrompt } from "../../env";
import {
  extractChunkWithRetry,
  isNonNarrativeChapter,
  parseAnalyzeChapterInput,
  renderPrompt,
} from "../helpers";
import type { ChapterAnalysis } from "../../../../lib/import-novel/types";

const SYSTEM_PROMPT_FILE = "novel-chunk-extractor.system.md";
const USER_PROMPT_FILE = "novel-chunk-extractor.user.md";
const RETRY_PROMPT_FILE = "novel-chunk-extractor.retry.md";

export async function POST(request: NextRequest) {
  let input;
  try {
    input = parseAnalyzeChapterInput(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "请求格式无效" }, { status: 400 });
  }

  if (isNonNarrativeChapter(input.chapterTitle, input.paragraphs)) {
    return NextResponse.json({ error: "该页面属于电子书前置信息，不作为互动章节" }, { status: 422 });
  }

  const apiKey = getEnv("LLM_API_KEY");
  const baseUrl = getEnv("LLM_BASE_URL");
  const model = getEnv("LLM_IMPORT_MODEL") || getEnv("LLM_MODEL");
  if (!apiKey || !baseUrl || !model) return NextResponse.json({ error: "缺少 LLM 配置" }, { status: 500 });

  try {
    const systemPrompt = loadPrompt(SYSTEM_PROMPT_FILE).trim();
    const userTemplate = loadPrompt(USER_PROMPT_FILE);
    const retryPrompt = loadPrompt(RETRY_PROMPT_FILE).trim();
    if (!systemPrompt || !retryPrompt) throw new Error("章节提取提示词缺失");

    const sourceHash = await sha256(serializeChapterSource(input.chapterTitle, input.paragraphs));
    const promptHash = await sha256(`${systemPrompt}\n---\n${userTemplate.trim()}\n---\n${retryPrompt}`);
    const chunks = createParagraphChunks(input.paragraphs);
    const results: ChapterAnalysis[] = [];

    for (let index = 0; index < chunks.length; index += CHUNK_ANALYSIS_CONCURRENCY) {
      const batch = chunks.slice(index, index + CHUNK_ANALYSIS_CONCURRENCY);
      results.push(...await Promise.all(batch.map((chunk) => {
        const userPrompt = renderPrompt(userTemplate, {
          CHAPTER_TITLE: input.chapterTitle,
          CHAPTER_CONTENT: chunk.paragraphs.map((paragraph) => `[${paragraph.id}] ${paragraph.text}`).join("\n"),
        });
        return extractChunkWithRetry({ apiKey, baseUrl, model, systemPrompt, userPrompt, retryPrompt, paragraphs: chunk.paragraphs })
          .catch((error: unknown) => {
            if (error instanceof Error && error.message === "该页面属于电子书前置信息，不作为互动章节") {
              throw error;
            }
            console.warn(`[novel-import] chunk ${chunk.index + 1}/${chunks.length} uses source-only plan:`, error instanceof Error ? error.message : error);
            return createSourceOnlyChunkPlan(chunk.paragraphs);
          });
      })));
    }

    const paragraphIds = input.paragraphs.map((paragraph) => paragraph.id);
    const result = mergeChapterPlan(results, paragraphIds, sourceHash);
    const finalPlan = { ...result, promptHash };
    assertChapterPlan(finalPlan, input.paragraphs, sourceHash);
    return NextResponse.json({ result: finalPlan });
  } catch (error) {
    if (error instanceof Error && error.message === "该页面属于电子书前置信息，不作为互动章节") {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "章节结构提取失败" }, { status: 500 });
  }
}
