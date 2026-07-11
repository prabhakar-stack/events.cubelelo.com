import { env } from "../config/env";

type JobHandler = (data: Record<string, unknown>) => Promise<void>;

interface QueueInterface {
  add(name: string, data: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
}

const handlers = new Map<string, JobHandler>();

export function registerWorker(jobName: string, handler: JobHandler): void {
  handlers.set(jobName, handler);
}

let queue: QueueInterface | null = null;

async function createBullQueue(): Promise<QueueInterface> {
  const { Queue, Worker } = await import("bullmq");
  const connection = { url: env.REDIS_URL };

  const q = new Queue("cubers", { connection });

  const w = new Worker(
    "cubers",
    async (job) => {
      const handler = handlers.get(job.name);
      if (!handler) {
        console.warn(`No handler for job: ${job.name}`);
        return;
      }
      await handler(job.data);
    },
    {
      connection,
      concurrency: 3,
    },
  );

  console.log("📋 BullMQ worker started");
  return {
    async add(name, data) {
      await q.add(name, data);
    },
    async close() {
      await w.close();
      await q.close();
    },
  };
}

function createInMemoryQueue(): QueueInterface {
  return {
    async add(name, data) {
      const handler = handlers.get(name);
      if (handler) {
        handler(data).catch((err) =>
          console.error(`Job ${name} failed:`, err),
        );
      }
    },
    async close() {},
  };
}

export async function getQueue(): Promise<QueueInterface> {
  if (queue) return queue;
  queue = env.REDIS_URL ? await createBullQueue() : createInMemoryQueue();
  return queue;
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
