/**
 * Storage abstraction. MVP writes to local disk under /uploads. Swap this single
 * module for S3/Supabase later without touching callers.
 */
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export interface StoredFile {
  filename: string;
  path: string; // relative path used as the stored reference
}

export async function saveFile(file: File): Promise<StoredFile> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const stored = `${randomUUID()}-${safeName}`;
  const fullPath = path.join(UPLOAD_DIR, stored);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, bytes);
  return { filename: file.name, path: `/uploads/${stored}` };
}
