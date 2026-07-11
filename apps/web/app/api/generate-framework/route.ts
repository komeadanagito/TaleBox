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
    // It's a JSON object
    start = startObj;
    end = cleaned.lastIndexOf("}");
  } else if (startArr !== -1) {
    // It's a JSON array
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
    const { genre, inspiration } = await req.json();
    
    const apiKey = getEnv("LLM_API_KEY");
    const baseUrl = getEnv("LLM_BASE_URL");
    const model = getEnv("LLM_MODEL") || "qwen3.6-max-preview";
    
    if (!apiKey || !baseUrl) {
      return NextResponse.json({ error: "Missing LLM API Key or Base URL config in environment." }, { status: 500 });
    }

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    };

    // ==========================================
    // 阶段 1：小说大纲与书名设计 (Outline Agent)
    // ==========================================
    const outlineTemplate = loadPrompt("creation-agent.md");
    if (!outlineTemplate) {
      return NextResponse.json({ error: "Failed to load creation-agent.md prompt template." }, { status: 500 });
    }

    const outlinePrompt = outlineTemplate
      .replace("{{GENRE}}", genre)
      .replace("{{INSPIRATION}}", inspiration);

    const outlineRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是一个结构化小说创意编排助手。你只能输出合法的 JSON 格式文本，绝不包含任何前言、后记或 Markdown 标记。" },
          { role: "user", content: outlinePrompt }
        ],
        temperature: 0.8
      })
    });

    const outlineData = await outlineRes.json();
    if (!outlineRes.ok) {
      return NextResponse.json({ error: outlineData.error?.message || "Outline generation failed" }, { status: outlineRes.status });
    }

    const rawOutline = outlineData.choices?.[0]?.message?.content || "";
    const parsedOutline = cleanAndParseJSON(rawOutline);

    const storyTitle = parsedOutline.title;
    const storyWorldView = parsedOutline.worldView;
    const storyGenre = parsedOutline.genre || genre;
    const storyNarrativeTone = parsedOutline.narrativeTone || "";
    const storyCoreConflict = parsedOutline.coreConflict || "";
    const storyChapter1Goal = parsedOutline.chapter1Goal || "";

    // ==========================================
    // 阶段 2：小说角色塑造 (Character Builder Agent)
    // ==========================================
    const charTemplate = loadPrompt("character-builder.md");
    if (!charTemplate) {
      return NextResponse.json({ error: "Failed to load character-builder.md prompt template." }, { status: 500 });
    }

    const charPrompt = charTemplate
      .replace("{{TITLE}}", storyTitle)
      .replace("{{GENRE}}", storyGenre)
      .replace("{{WORLD_VIEW}}", storyWorldView);

    const charRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是一个专业的角色设计师。你只能输出合法的 JSON 数组文本，绝不包含任何前言、后记或 Markdown 标记。" },
          { role: "user", content: charPrompt }
        ],
        temperature: 0.85
      })
    });

    const charData = await charRes.json();
    if (!charRes.ok) {
      return NextResponse.json({ error: charData.error?.message || "Characters generation failed" }, { status: charRes.status });
    }

    const rawChars = charData.choices?.[0]?.message?.content || "";
    const storyCharacters = cleanAndParseJSON(rawChars);

    // ==========================================
    // 阶段 3：小说道具设计 (Item Designer Agent)
    // ==========================================
    const itemTemplate = loadPrompt("item-designer.md");
    if (!itemTemplate) {
      return NextResponse.json({ error: "Failed to load item-designer.md prompt template." }, { status: 500 });
    }

    const charListContext = storyCharacters.map((c: any) => `- ${c.name} (${c.role}，${c.age || "年龄未设定"}，${c.gender === "female" ? "女" : c.gender === "male" ? "男" : "性别未设定"}，与主角关系：${c.relationshipToProtagonist || "未设定"}): 外显性格：${c.personality || c.persona || "未设定"}；内心秘密：${c.secret || "未设定"}`).join("\n");
    const itemPrompt = itemTemplate
      .replace("{{TITLE}}", storyTitle)
      .replace("{{GENRE}}", storyGenre)
      .replace("{{WORLD_VIEW}}", storyWorldView)
      .replace("{{CHARACTER_LIST}}", charListContext);

    const itemRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是一个结构化道具法宝设计师。你只能输出合法的 JSON 数组文本，绝不包含任何前言、后记或 Markdown 标记。" },
          { role: "user", content: itemPrompt }
        ],
        temperature: 0.8
      })
    });

    const itemData = await itemRes.json();
    if (!itemRes.ok) {
      return NextResponse.json({ error: itemData.error?.message || "Items generation failed" }, { status: itemRes.status });
    }

    const rawItems = itemData.choices?.[0]?.message?.content || "";
    const storyItems = cleanAndParseJSON(rawItems).map((item: any, idx: number) => ({
      ...item,
      discovered: idx === 0
    }));

    // ==========================================
    // 阶段 4：小说场景架设与开局 (Scene Architect Agent)
    // ==========================================
    const sceneTemplate = loadPrompt("scene-architect.md");
    if (!sceneTemplate) {
      return NextResponse.json({ error: "Failed to load scene-architect.md prompt template." }, { status: 500 });
    }

    const itemListContext = storyItems.map((i: any) => `- 【${i.name}】: ${i.description}`).join("\n");
    const scenePrompt = sceneTemplate
      .replace("{{TITLE}}", storyTitle)
      .replace("{{GENRE}}", storyGenre)
      .replace("{{WORLD_VIEW}}", storyWorldView)
      .replace("{{CHARACTER_LIST}}", charListContext)
      .replace("{{ITEM_LIST}}", itemListContext);

    const sceneRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是一个小说场景设定师。你只能输出合法的 JSON 对象文本，绝不包含任何前言、后记或 Markdown 标记。" },
          { role: "user", content: scenePrompt }
        ],
        temperature: 0.8
      })
    });

    const sceneData = await sceneRes.json();
    if (!sceneRes.ok) {
      return NextResponse.json({ error: sceneData.error?.message || "Scenes generation failed" }, { status: sceneRes.status });
    }

    const rawScenes = sceneData.choices?.[0]?.message?.content || "";
    const parsedScenes = cleanAndParseJSON(rawScenes);

    // Combine all modular outputs into a single framework payload
    const finalizedFramework = {
      title: storyTitle,
      genre: storyGenre,
      worldView: storyWorldView,
      narrativeTone: storyNarrativeTone,
      coreConflict: storyCoreConflict,
      chapterGoal: parsedScenes.chapter1Goal || storyChapter1Goal,
      characters: storyCharacters,
      items: storyItems,
      scenes: parsedScenes.scenes,
      chapter1: parsedScenes.chapter1,
      suggestions: parsedScenes.suggestions
    };

    return NextResponse.json({ result: finalizedFramework });

  } catch (e: any) {
    console.error("Framework orchestration error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
