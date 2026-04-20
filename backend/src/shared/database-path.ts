import path from "node:path";

export function getDatabasePath() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (raw.startsWith("file:")) {
    const backendRoot = path.resolve(__dirname, "..", "..");
    return path.resolve(backendRoot, raw.slice("file:".length));
  }

  return raw;
}
