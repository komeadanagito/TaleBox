import type { AiNarrativeMode, ChapterAnalysis, ChapterSession, ImportedNovel, NovelDriveMode } from "./types";
import { createParagraphs } from "./parser";
import { serializeChapterSource, sha256 } from "./compiler/hash";
import { assertChapterPlan } from "./compiler/validator";

const DB_NAME = "talebox-imported-novels";
const DB_VERSION = 3;
const STORE_NAME = "novels";
const SESSION_STORE_NAME = "chapterSessions";
const PLAN_STORE_NAME = "chapterPlans";
const PLAN_NOVEL_INDEX = "novelId";

interface ChapterPlanRecord {
  id: string;
  novelId: string;
  chapterNumber: number;
  analysis: ChapterAnalysis;
  updatedAt: string;
}

const sessionWriteQueues = new Map<string, Promise<void>>();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!database.objectStoreNames.contains(SESSION_STORE_NAME)) database.createObjectStore(SESSION_STORE_NAME, { keyPath: "id" });
      const planStore = database.objectStoreNames.contains(PLAN_STORE_NAME)
        ? request.transaction!.objectStore(PLAN_STORE_NAME)
        : database.createObjectStore(PLAN_STORE_NAME, { keyPath: "id" });
      if (!planStore.indexNames.contains(PLAN_NOVEL_INDEX)) planStore.createIndex(PLAN_NOVEL_INDEX, "novelId", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地小说数据库"));
  });
}

export function chapterSessionId(novelId: string, chapterNumber: number, roleId: string, driveMode: NovelDriveMode = "original", aiNarrativeMode: AiNarrativeMode = "faithful") {
  const base = `${novelId}:${chapterNumber}:${roleId}`;
  return driveMode === "ai" ? `${base}:ai:${aiNarrativeMode}` : base;
}

function chapterPlanId(novelId: string, chapterNumber: number) {
  return `${novelId}:${chapterNumber}`;
}

async function waitForSessionWrite(id: string) {
  const pending = sessionWriteQueues.get(id);
  if (pending) await pending;
}

async function writeChapterSession(session: ChapterSession) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(SESSION_STORE_NAME, "readwrite");
      transaction.objectStore(SESSION_STORE_NAME).put(session);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("保存章节进度失败"));
      transaction.onabort = () => reject(transaction.error || new Error("保存章节进度失败"));
    });
  } finally {
    database.close();
  }
}

export async function getChapterSession(novelId: string, chapterNumber: number, roleId: string, driveMode: NovelDriveMode = "original", aiNarrativeMode: AiNarrativeMode = "faithful"): Promise<ChapterSession | null> {
  const id = chapterSessionId(novelId, chapterNumber, roleId, driveMode, aiNarrativeMode);
  await waitForSessionWrite(id);
  const database = await openDatabase();
  const session = await new Promise<ChapterSession | null>((resolve, reject) => {
    const request = database.transaction(SESSION_STORE_NAME, "readonly").objectStore(SESSION_STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as ChapterSession | undefined) || null);
    request.onerror = () => reject(request.error || new Error("读取章节进度失败"));
  });
  database.close();
  return session;
}

export async function saveChapterSession(session: ChapterSession) {
  const snapshot = structuredClone(session);
  const previous = sessionWriteQueues.get(session.id) || Promise.resolve();
  const write = previous.catch(() => undefined).then(() => writeChapterSession(snapshot));
  sessionWriteQueues.set(session.id, write);
  try {
    await write;
  } finally {
    if (sessionWriteQueues.get(session.id) === write) sessionWriteQueues.delete(session.id);
  }
}

export async function listChapterSessions(): Promise<ChapterSession[]> {
  await Promise.allSettled([...sessionWriteQueues.values()]);
  const database = await openDatabase();
  const sessions = await new Promise<ChapterSession[]>((resolve, reject) => {
    const request = database.transaction(SESSION_STORE_NAME, "readonly").objectStore(SESSION_STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as ChapterSession[] | undefined) || []);
    request.onerror = () => reject(request.error || new Error("读取阅读进度失败"));
  });
  database.close();
  return sessions;
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
  const transaction = database.transaction([STORE_NAME, PLAN_STORE_NAME], "readonly");
  const [novel, planRecords] = await Promise.all([
    new Promise<ImportedNovel | null>((resolve, reject) => {
      const request = transaction.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve((request.result as ImportedNovel | undefined) || null);
      request.onerror = () => reject(request.error || new Error("读取小说失败"));
    }),
    new Promise<ChapterPlanRecord[]>((resolve, reject) => {
      const request = transaction.objectStore(PLAN_STORE_NAME).index(PLAN_NOVEL_INDEX).getAll(IDBKeyRange.only(id));
      request.onsuccess = () => resolve((request.result as ChapterPlanRecord[] | undefined) || []);
      request.onerror = () => reject(request.error || new Error("读取章节计划失败"));
    }),
  ]);
  database.close();
  if (novel) {
    if (!novel.fileType) novel.fileType = novel.fileName.toLowerCase().endsWith(".epub") ? "epub" : "txt";
    const currentPlans = new Map(planRecords
      .filter((record) => record.analysis?.sourceMode === "faithful-v3")
      .map((record) => [record.chapterNumber, record.analysis]));
    for (const chapter of novel.chapters) {
      if (!Array.isArray(chapter.paragraphs) || chapter.paragraphs.length === 0) chapter.paragraphs = createParagraphs(chapter.content);
      const currentPlan = currentPlans.get(chapter.number);
      if (currentPlan) chapter.analysis = currentPlan;
    }
  }
  return novel;
}

export async function listImportedNovels(): Promise<ImportedNovel[]> {
  const database = await openDatabase();
  const novels = await new Promise<ImportedNovel[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as ImportedNovel[] | undefined) || []);
    request.onerror = () => reject(request.error || new Error("读取上传书架失败"));
  });
  database.close();
  return novels.map((novel) => ({ ...novel, fileType: novel.fileType || (novel.fileName.toLowerCase().endsWith(".epub") ? "epub" : "txt") })).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function deleteImportedNovel(id: string) {
  const pendingWrites = [...sessionWriteQueues.entries()]
    .filter(([sessionId]) => sessionId.startsWith(`${id}:`))
    .map(([, write]) => write);
  await Promise.allSettled(pendingWrites);
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME, SESSION_STORE_NAME, PLAN_STORE_NAME], "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    const sessionStore = transaction.objectStore(SESSION_STORE_NAME);
    const request = sessionStore.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (String(cursor.key).startsWith(`${id}:`)) cursor.delete();
      cursor.continue();
    };
    const planRequest = transaction.objectStore(PLAN_STORE_NAME).index(PLAN_NOVEL_INDEX).openCursor(IDBKeyRange.only(id));
    planRequest.onsuccess = () => {
      const cursor = planRequest.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("移除上传小说失败"));
  });
  database.close();
}

export async function saveChapterAnalysis(novelId: string, chapterNumber: number, analysis: ChapterAnalysis) {
  const novel = await getImportedNovel(novelId);
  if (!novel) throw new Error("没有找到导入的小说");
  const chapter = novel.chapters.find((item) => item.number === chapterNumber);
  if (!chapter) throw new Error("没有找到对应章节");
  const sourceHash = await sha256(serializeChapterSource(chapter.title, chapter.paragraphs));
  assertChapterPlan(analysis, chapter.paragraphs, sourceHash);
  chapter.analysis = analysis;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PLAN_STORE_NAME, "readwrite");
      const record: ChapterPlanRecord = {
        id: chapterPlanId(novelId, chapterNumber),
        novelId,
        chapterNumber,
        analysis,
        updatedAt: new Date().toISOString(),
      };
      transaction.objectStore(PLAN_STORE_NAME).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("保存章节计划失败"));
      transaction.onabort = () => reject(transaction.error || new Error("保存章节计划失败"));
    });
  } finally {
    database.close();
  }
  return novel;
}
