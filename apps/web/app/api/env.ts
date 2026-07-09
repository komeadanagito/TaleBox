import fs from "fs";
import path from "path";

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
      "/Users/quan/MyFile/CodeProject/TaleBox/.env" // absolute path fallback
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
  try {
    const cwd = process.cwd();
    const pathsToTry = [
      path.join(cwd, "packages/prompts", fileName),
      path.join(cwd, "../../packages/prompts", fileName),
      path.join(cwd, "apps/web/../../packages/prompts", fileName),
      path.join("/Users/quan/MyFile/CodeProject/TaleBox/packages/prompts", fileName) // absolute fallback
    ];
    
    for (const p of pathsToTry) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, "utf-8");
      }
    }
  } catch (err) {
    console.error("Error loading prompt " + fileName + ":", err);
  }
  
  return "";
}
