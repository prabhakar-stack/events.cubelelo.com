import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { env } from "../config/env";

export interface StorageService {
  upload(filename: string, data: Buffer, contentType: string): Promise<string>;
}

function createSupabaseStorage(): StorageService {
  const supabaseUrl = env.SUPABASE_STORAGE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;
  const bucket = env.SUPABASE_STORAGE_BUCKET;

  return {
    async upload(filename, data, contentType) {
      const ext = extname(filename) || ".bin";
      const key = `uploads/${randomUUID()}${ext}`;

      const encodedBucket = encodeURIComponent(bucket);
      const res = await fetch(
        `${supabaseUrl}/storage/v1/object/${encodedBucket}/${key}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": contentType,
            "x-upsert": "true",
          },
          body: data,
        },
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Supabase storage upload failed (${res.status}): ${body}`);
      }

      return `${supabaseUrl}/storage/v1/object/public/${encodedBucket}/${key}`;
    },
  };
}

function createLocalStorage(): StorageService {
  const uploadDir = join(process.cwd(), "uploads");

  return {
    async upload(filename, data, _contentType) {
      await mkdir(uploadDir, { recursive: true });
      const ext = extname(filename) || ".bin";
      const newName = `${randomUUID()}${ext}`;
      await writeFile(join(uploadDir, newName), data);
      return `/uploads/${newName}`;
    },
  };
}

let storageInstance: StorageService | null = null;

export function getStorage(): StorageService {
  if (storageInstance) return storageInstance;

  if (env.SUPABASE_STORAGE_URL && env.SUPABASE_SERVICE_KEY && env.SUPABASE_STORAGE_BUCKET) {
    console.log("☁️  Using Supabase storage");
    storageInstance = createSupabaseStorage();
    return storageInstance;
  }

  console.log("📁 Using local file storage (no Supabase storage configured)");
  storageInstance = createLocalStorage();
  return storageInstance;
}
