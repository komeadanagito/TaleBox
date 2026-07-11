import type { ImportedChapter, ImportedNovel, SourceParagraph } from "./types";

const CHAPTER_HEADING = /^\s*((?:第[零〇一二三四五六七八九十百千万两\d]+[章节回卷部篇幕集]|chapter\s*\d+)[^\n]{0,40})\s*$/gim;

function decodeNovel(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(bytes.slice(3)), encoding: "UTF-8" };
  }
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const replacementRatio = (utf8.match(/�/g)?.length || 0) / Math.max(utf8.length, 1);
  if (replacementRatio < 0.002) return { text: utf8, encoding: "UTF-8" };
  try {
    return { text: new TextDecoder("gb18030").decode(bytes), encoding: "GB18030" };
  } catch {
    return { text: utf8, encoding: "UTF-8（可能存在乱码）" };
  }
}

function normalizeText(raw: string) {
  return raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/[\t\u00a0]+/g, " ").replace(/\n{4,}/g, "\n\n\n").trim();
}

function makeChapter(number: number, title: string, content: string): ImportedChapter {
  const normalized = content.trim();
  return { id: `chapter-${number}`, number, title: title.trim(), content: normalized, paragraphs: createParagraphs(normalized), wordCount: normalized.replace(/\s/g, "").length };
}

export function createParagraphs(content: string): SourceParagraph[] {
  const paragraphs: SourceParagraph[] = [];
  const pattern = /[^\n]+(?:\n+|$)/g;
  for (const match of content.matchAll(pattern)) {
    const text = match[0].trim();
    if (!text) continue;
    const startOffset = match.index || 0;
    paragraphs.push({ id: `p-${String(paragraphs.length + 1).padStart(4, "0")}`, index: paragraphs.length, text, startOffset, endOffset: startOffset + match[0].length });
  }
  return paragraphs;
}

function splitChapters(text: string): ImportedChapter[] {
  const matches = [...text.matchAll(CHAPTER_HEADING)];
  if (matches.length === 0) return [makeChapter(1, "正文", text)];
  const chapters: ImportedChapter[] = [];
  const preface = text.slice(0, matches[0]!.index).trim();
  if (preface.length > 120) chapters.push(makeChapter(1, "序章", preface));
  matches.forEach((match, index) => {
    const start = (match.index || 0) + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    const number = chapters.length + 1;
    chapters.push(makeChapter(number, match[1] || `第 ${number} 章`, text.slice(start, end)));
  });
  return chapters.filter((chapter) => chapter.content.length > 0);
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[《》]/g, "").trim() || "未命名小说";
}

export async function parseNovelFile(file: File): Promise<ImportedNovel> {
  if (!file.name.toLowerCase().endsWith(".txt")) throw new Error("目前仅支持 TXT 文件");
  if (file.size > 5 * 1024 * 1024) throw new Error("文件不能超过 5MB");
  const decoded = decodeNovel(await file.arrayBuffer());
  const text = normalizeText(decoded.text);
  if (text.length < 100) throw new Error("文本内容过短，无法识别小说章节");
  const chapters = splitChapters(text);
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `novel-${Date.now()}`;
  return {
    id,
    title: titleFromFileName(file.name),
    author: "作者未识别",
    fileName: file.name,
    encoding: decoded.encoding,
    wordCount: chapters.reduce((total, chapter) => total + chapter.wordCount, 0),
    createdAt: new Date().toISOString(),
    chapters,
  };
}
