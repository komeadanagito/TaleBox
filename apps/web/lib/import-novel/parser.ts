import type { ImportedChapter, ImportedNovel, SourceParagraph } from "./types";
import JSZip from "jszip";

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
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "epub") return parseEpubFile(file);
  if (extension !== "txt") throw new Error("目前仅支持 TXT 或 EPUB 文件");
  return parseTxtFile(file);
}

async function parseTxtFile(file: File): Promise<ImportedNovel> {
  if (file.size > 5 * 1024 * 1024) throw new Error("TXT 文件不能超过 5MB");
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
    fileType: "txt",
    encoding: decoded.encoding,
    wordCount: chapters.reduce((total, chapter) => total + chapter.wordCount, 0),
    createdAt: new Date().toISOString(),
    chapters,
  };
}

function xmlText(document: Document, localName: string) {
  return document.getElementsByTagNameNS("*", localName)[0]?.textContent?.trim() || document.getElementsByTagName(localName)[0]?.textContent?.trim() || "";
}

function normalizeZipPath(path: string) {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function resolveHref(baseFile: string, href: string) {
  const directory = baseFile.includes("/") ? baseFile.slice(0, baseFile.lastIndexOf("/") + 1) : "";
  const cleanHref = href.split("#")[0] || "";
  try { return normalizeZipPath(directory + decodeURIComponent(cleanHref)); }
  catch { return normalizeZipPath(directory + cleanHref); }
}

function extractXhtml(html: string, fallbackTitle: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script,style,nav,svg,noscript").forEach((node) => node.remove());
  const title = document.querySelector("h1,h2,h3")?.textContent?.replace(/\s+/g, " ").trim()
    || document.querySelector("title")?.textContent?.trim()
    || fallbackTitle;
  const nodes = Array.from(document.querySelectorAll("p,blockquote,li,h1,h2,h3,h4"));
  const paragraphs = nodes.map((node) => node.textContent?.replace(/[\t\u00a0 ]+/g, " ").trim() || "").filter(Boolean);
  const content = paragraphs.length > 0 ? paragraphs.join("\n\n") : document.body.textContent?.replace(/\s*\n\s*/g, "\n").trim() || "";
  return { title, content };
}

const EPUB_CHAPTER_LABEL = /^(?:第[零〇一二三四五六七八九十百千万两\d]+[章节回篇幕集]|chapter\s*[\divxlcdm]+|序章|楔子|引子|前言|尾声|终章|后记|番外(?:[零〇一二三四五六七八九十\d]+)?)/i;
const EPUB_NON_STORY_LABEL = /^(?:封面|版权(?:声明|信息|页)?|版权所有|目录|扉页|题词|献词|致谢|作者简介|出版信息|奥付|contents?(?:\s+page)?|table\s+of\s+contents|toc|title\s*page|copyright(?:\s+notice|\s+page)?|all\s+rights\s+reserved|dedication|epigraph|acknowledgements?|about\s+the\s+author|publication\s+info|colophon)/i;
const EPUB_NON_STORY_CONTENT = /(?:all rights reserved|no part of this (?:book|publication)|isbn(?:-1[03])?\s*[:：]|copyright\s*[©\u00a9]|版权所有|未经许可.{0,20}(?:复制|转载)|出版发行)/i;
const EPUB_NON_STORY_PATH = /(?:^|\/)(?:p-)?(?:cover|titlepage|toc|credit|kanko|colophon|copyright|fmatter)(?:[-_.\/]|$)/i;

function cleanLabel(label: string) {
  return label.replace(/\s+/g, " ").replace(/^[·•\-—\s]+|[·•\-—\s]+$/g, "").trim();
}

function chapterKey(label: string) {
  const cleaned = cleanLabel(label).toLowerCase();
  const marker = cleaned.match(EPUB_CHAPTER_LABEL)?.[0];
  return (marker || cleaned)
    .replace(/[\s:：·•.,，。!！?？《》“”"'()（）\[\]【】_-]+/g, "")
    .replace(/(?:上|中|下|\d+\/\d+|part\d+|page\d+)$/i, "")
    .replace(/(?:第?[一二三四五六七八九十123456789]\s*[页部分]|part\s*[一二三四五六七八九十123456789]+)$/i, "");
}

type EpubTocEntry = { label: string; fragment: string };

async function readEpubToc(zip: JSZip, opfPath: string, manifest: Map<string, { href: string; mediaType: string; properties: string }>) {
  const entriesByPath = new Map<string, EpubTocEntry[]>();
  const addEntry = (href: string, label: string, baseFile: string) => {
    const path = resolveHref(baseFile, href);
    const cleaned = cleanLabel(label);
    let fragment = "";
    try { fragment = decodeURIComponent(href.split("#")[1] || ""); }
    catch { fragment = href.split("#")[1] || ""; }
    if (!path || !cleaned) return;
    const entries = entriesByPath.get(path) || [];
    if (!entries.some((entry) => entry.label === cleaned && entry.fragment === fragment)) entries.push({ label: cleaned, fragment });
    entriesByPath.set(path, entries);
  };

  const navItem = [...manifest.values()].find((item) => item.properties.split(/\s+/).includes("nav"));
  if (navItem) {
    const navPath = resolveHref(opfPath, navItem.href);
    const navFile = zip.file(navPath);
    if (navFile) {
      const document = new DOMParser().parseFromString(await navFile.async("text"), "text/html");
      const tocNav = Array.from(document.querySelectorAll("nav")).find((nav) => /toc/i.test(nav.getAttribute("epub:type") || nav.getAttribute("type") || nav.id)) || document.querySelector("nav");
      tocNav?.querySelectorAll("a[href]").forEach((anchor) => addEntry(anchor.getAttribute("href") || "", anchor.textContent || "", navPath));
    }
  }

  const ncxItem = [...manifest.values()].find((item) => /ncx/i.test(item.mediaType));
  if (ncxItem) {
    const ncxPath = resolveHref(opfPath, ncxItem.href);
    const ncxFile = zip.file(ncxPath);
    if (ncxFile) {
      const document = new DOMParser().parseFromString(await ncxFile.async("text"), "application/xml");
      Array.from(document.getElementsByTagName("navPoint")).forEach((point) => {
        const href = point.getElementsByTagName("content")[0]?.getAttribute("src") || "";
        const label = point.getElementsByTagName("navLabel")[0]?.textContent || "";
        addEntry(href, label, ncxPath);
      });
    }
  }
  return entriesByPath;
}

type EpubDocument = { path: string; title: string; content: string; tocLabel?: string };

function extractXhtmlByToc(html: string, fallbackTitle: string, tocEntries: EpubTocEntry[]) {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script,style,nav,svg,noscript").forEach((node) => node.remove());
  const nodes = Array.from(document.querySelectorAll("p,blockquote,li,h1,h2,h3,h4"));
  if (nodes.length === 0 || tocEntries.length <= 1 || !tocEntries.some((entry) => entry.fragment)) {
    const extracted = extractXhtml(html, fallbackTitle);
    return [{ ...extracted, ...(tocEntries[0]?.label ? { tocLabel: tocEntries[0].label } : {}) }];
  }

  const boundaries = tocEntries.flatMap((entry) => {
    if (!entry.fragment) return [{ entry, index: 0 }];
    const target = document.getElementById(entry.fragment) || document.querySelector(`[name="${CSS.escape(entry.fragment)}"]`);
    if (!target) return [];
    const directIndex = nodes.findIndex((node) => node === target || target.contains(node));
    if (directIndex >= 0) return [{ entry, index: directIndex }];
    const followingIndex = nodes.findIndex((node) => Boolean(target.compareDocumentPosition(node) & 4));
    return followingIndex >= 0 ? [{ entry, index: followingIndex }] : [];
  }).sort((a, b) => a.index - b.index);

  if (boundaries.length <= 1) {
    const extracted = extractXhtml(html, fallbackTitle);
    return [{ ...extracted, ...(tocEntries[0]?.label ? { tocLabel: tocEntries[0].label } : {}) }];
  }

  return boundaries.map((boundary, index) => {
    const end = boundaries[index + 1]?.index ?? nodes.length;
    const content = nodes.slice(boundary.index, end).map((node) => node.textContent?.replace(/[\t\u00a0 ]+/g, " ").trim() || "").filter(Boolean).join("\n\n");
    return { title: boundary.entry.label || fallbackTitle, content, tocLabel: boundary.entry.label };
  }).filter((section) => section.content.replace(/\s/g, "").length >= 30);
}

function groupEpubDocuments(documents: EpubDocument[], hasToc: boolean) {
  const groups: Array<{ title: string; key: string; contents: string[] }> = [];
  for (const document of documents) {
    const label = cleanLabel(document.tocLabel || document.title);
    const compactLength = document.content.replace(/\s/g, "").length;
    if (EPUB_NON_STORY_LABEL.test(label) || (compactLength < 6000 && EPUB_NON_STORY_CONTENT.test(document.content.slice(0, 2500)))) continue;
    const key = chapterKey(label);
    const current = groups[groups.length - 1];
    const sameChapter = Boolean(current && key && current.key === key);
    const strongHeading = EPUB_CHAPTER_LABEL.test(label);
    const explicitTocBoundary = Boolean(document.tocLabel);
    const shouldStart = !current || (!sameChapter && (hasToc ? explicitTocBoundary : strongHeading));

    if (shouldStart) groups.push({ title: label || `第 ${groups.length + 1} 章`, key, contents: [document.content] });
    else current.contents.push(document.content);
  }
  return groups.map((group) => ({ title: group.title, content: group.contents.filter(Boolean).join("\n\n") })).filter((group) => group.content.replace(/\s/g, "").length >= 30);
}

async function parseEpubFile(file: File): Promise<ImportedNovel> {
  if (file.size > 30 * 1024 * 1024) throw new Error("EPUB 文件不能超过 30MB");
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(await file.arrayBuffer()); }
  catch { throw new Error("EPUB 文件已损坏或不是有效的电子书"); }

  const containerFile = zip.file("META-INF/container.xml");
  let opfPath = "";
  if (containerFile) {
    const containerDocument = new DOMParser().parseFromString(await containerFile.async("text"), "application/xml");
    opfPath = containerDocument.querySelector("rootfile")?.getAttribute("full-path") || "";
  }
  if (!opfPath) opfPath = Object.keys(zip.files).find((path) => path.toLowerCase().endsWith(".opf")) || "";
  const opfFile = opfPath ? zip.file(opfPath) : null;
  if (!opfFile) throw new Error("EPUB 中缺少书籍目录文件");

  const opfDocument = new DOMParser().parseFromString(await opfFile.async("text"), "application/xml");
  if (opfDocument.querySelector("parsererror")) throw new Error("EPUB 目录结构无法读取");
  const bookTitle = xmlText(opfDocument, "title") || titleFromFileName(file.name);
  const author = xmlText(opfDocument, "creator") || "作者未识别";
  const manifest = new Map<string, { href: string; mediaType: string; properties: string }>();
  Array.from(opfDocument.getElementsByTagName("item")).forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, { href, mediaType: item.getAttribute("media-type") || "", properties: item.getAttribute("properties") || "" });
  });
  const legacyCoverId = Array.from(opfDocument.getElementsByTagName("meta")).find((meta) => meta.getAttribute("name") === "cover")?.getAttribute("content") || "";
  const coverItem = [...manifest.entries()].find(([, item]) => item.properties.split(/\s+/).includes("cover-image"))
    || (legacyCoverId && manifest.has(legacyCoverId) ? [legacyCoverId, manifest.get(legacyCoverId)!] as const : undefined);
  let coverDataUrl: string | undefined;
  if (coverItem) {
    const coverFile = zip.file(resolveHref(opfPath, coverItem[1].href));
    if (coverFile && /^image\//i.test(coverItem[1].mediaType)) {
      const base64 = await coverFile.async("base64");
      coverDataUrl = `data:${coverItem[1].mediaType};base64,${base64}`;
    }
  }
  const spineIds = Array.from(opfDocument.getElementsByTagName("itemref")).map((item) => item.getAttribute("idref")).filter((id): id is string => Boolean(id));
  const tocEntries = await readEpubToc(zip, opfPath, manifest);
  const documents: EpubDocument[] = [];
  let pendingChapterLabel = "";
  for (const id of spineIds) {
    const item = manifest.get(id);
    if (!item || item.properties.includes("nav") || !/(xhtml|html)/i.test(item.mediaType)) continue;
    const contentPath = resolveHref(opfPath, item.href);
    if (EPUB_NON_STORY_PATH.test(contentPath)) continue;
    const contentFile = zip.file(contentPath);
    if (!contentFile) continue;
    const entriesForFile = tocEntries.get(contentPath) || [];
    const storyEntry = entriesForFile.find((entry) => !EPUB_NON_STORY_LABEL.test(entry.label));
    if (storyEntry && EPUB_CHAPTER_LABEL.test(storyEntry.label)) pendingChapterLabel = storyEntry.label;
    const sections = extractXhtmlByToc(await contentFile.async("text"), `第 ${documents.length + 1} 章`, entriesForFile);
    let appendedContent = false;
    for (const extracted of sections) {
      if (extracted.content.replace(/\s/g, "").length < 30) continue;
      const inheritedLabel = extracted.tocLabel || pendingChapterLabel;
      documents.push({ path: contentPath, title: inheritedLabel || extracted.title, content: extracted.content, ...(inheritedLabel ? { tocLabel: inheritedLabel } : {}) });
      appendedContent = true;
      pendingChapterLabel = "";
    }
    if (!appendedContent && storyEntry && EPUB_CHAPTER_LABEL.test(storyEntry.label)) pendingChapterLabel = storyEntry.label;
  }
  const groupedDocuments = groupEpubDocuments(documents, tocEntries.size > 0);
  const chapters = groupedDocuments.map((group, index) => makeChapter(index + 1, group.title, group.content));
  if (chapters.length === 0) throw new Error("EPUB 中没有找到可阅读的正文章节");
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `novel-${Date.now()}`;
  return { id, title: bookTitle, author, fileName: file.name, fileType: "epub", ...(coverDataUrl ? { coverDataUrl } : {}), encoding: "EPUB", wordCount: chapters.reduce((total, chapter) => total + chapter.wordCount, 0), createdAt: new Date().toISOString(), chapters };
}
