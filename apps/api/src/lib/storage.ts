import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { env } from "../config/env";

export interface StorageService {
  upload(filename: string, data: Buffer, contentType: string): Promise<string>;
}

async function createR2Storage(): Promise<StorageService> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  return {
    async upload(filename, data, contentType) {
      const ext = extname(filename) || ".bin";
      const key = `uploads/${randomUUID()}${ext}`;

      await client.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET,
          Key: key,
          Body: data,
          ContentType: contentType,
        }),
      );

      if (env.R2_PUBLIC_URL) {
        return `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
      }
      return `/${key}`;
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

  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET) {
    console.log("☁️  Using Cloudflare R2 storage");
    // Lazy init — the async import happens on first upload
    const placeholder: StorageService = {
      async upload(filename, data, contentType) {
        const r2 = await createR2Storage();
        storageInstance = r2;
        return r2.upload(filename, data, contentType);
      },
    };
    storageInstance = placeholder;
    return placeholder;
  }

  console.log("📁 Using local file storage (no R2 configured)");
  storageInstance = createLocalStorage();
  return storageInstance;
}
