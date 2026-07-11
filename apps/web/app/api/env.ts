import fs from "fs";
import path from "path";

const promptCache = new Map<string, string>();

export function getEnv(key: string): string {
  // 1. Try standard process.env
  if (process.env[key]) {
    return process.env[key]!;
  }
  
  // 2. Try loading from workspace root or apps/web/.env
  try {
    const cwd = process.cwd();
    const pathsToTry = [
      path.join(cwd, ".env"),
      path.join(cwd, "../../.env"),
      path.join(cwd, "apps/web/.env"),
    ];
    
    for (const envPath of pathsToTry) {
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf-8");
        const lines = envContent.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const eqIdx = trimmed.indexOf("=");
            const k = trimmed.substring(0, eqIdx).trim();
            const v = trimmed.substring(eqIdx + 1).trim();
            if (k === key) {
              // Strip quotes
              return v.replace(/^["']|["']$/g, "");
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("Error reading environment config:", e);
  }
  
  return "";
}

export function loadPrompt(fileName: string): string {
  if (path.basename(fileName) !== fileName) throw new Error(`Invalid prompt file name: ${fileName}`);
  const isDev = process.env.NODE_ENV === "development";
  const cached = promptCache.get(fileName);
  if (cached && !isDev) return cached;

  const cwd = process.cwd();
  const pathsToTry = [
    path.resolve(cwd, "packages/prompts", fileName),
    path.resolve(cwd, "../../packages/prompts", fileName),
  ];

  for (const promptPath of pathsToTry) {
    if (!fs.existsSync(promptPath)) continue;
    const prompt = fs.readFileSync(promptPath, "utf-8").trim();
    if (!prompt) throw new Error(`Prompt file is empty: ${fileName}`);
    promptCache.set(fileName, prompt);
    return prompt;
  }

  throw new Error(`Prompt file not found: ${fileName}`);
}
