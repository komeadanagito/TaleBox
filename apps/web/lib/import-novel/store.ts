import type { ChapterAnalysis, ChapterSession, ImportedNovel } from "./types";
import { createParagraphs } from "./parser";

const DB_NAME = "talebox-imported-novels";
const DB_VERSION = 2;
const STORE_NAME = "novels";
const SESSION_STORE_NAME = "chapterSessions";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!database.objectStoreNames.contains(SESSION_STORE_NAME)) database.createObjectStore(SESSION_STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地小说数据库"));
  });
}

export function chapterSessionId(novelId: string, chapterNumber: number, roleId: string) {
  return `${novelId}:${chapterNumber}:${roleId}`;
}

export async function getChapterSession(novelId: string, chapterNumber: number, roleId: string): Promise<ChapterSession | null> {
  const database = await openDatabase();
  const id = chapterSessionId(novelId, chapterNumber, roleId);
  const session = await new Promise<ChapterSession | null>((resolve, reject) => {
    const request = database.transaction(SESSION_STORE_NAME, "readonly").objectStore(SESSION_STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as ChapterSession | undefined) || null);
    request.onerror = () => reject(request.error || new Error("读取章节进度失败"));
  });
  database.close();
  return session;
}

export async function saveChapterSession(session: ChapterSession) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SESSION_STORE_NAME, "readwrite");
    transaction.objectStore(SESSION_STORE_NAME).put(session);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("保存章节进度失败"));
  });
  database.close();
}

export async function saveImportedNovel(novel: ImportedNovel) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(novel);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("保存小说失败"));
  });
  database.close();
}

export async function getImportedNovel(id: string): Promise<ImportedNovel | null> {
  const database = await openDatabase();
  const novel = await new Promise<ImportedNovel | null>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as ImportedNovel | undefined) || null);
    request.onerror = () => reject(request.error || new Error("读取小说失败"));
  });
  database.close();
  if (novel) {
    for (const chapter of novel.chapters) {
      if (!Array.isArray(chapter.paragraphs) || chapter.paragraphs.length === 0) chapter.paragraphs = createParagraphs(chapter.content);
    }
  }
  return novel;
}

export async function saveChapterAnalysis(novelId: string, chapterNumber: number, analysis: ChapterAnalysis) {
  const novel = await getImportedNovel(novelId);
  if (!novel) throw new Error("没有找到导入的小说");
  const chapter = novel.chapters.find((item) => item.number === chapterNumber);
  if (!chapter) throw new Error("没有找到对应章节");
  chapter.analysis = analysis;
  await saveImportedNovel(novel);
  return novel;
}
