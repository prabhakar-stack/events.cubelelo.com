import { env } from "../config/env";

type JobHandler = (data: Record<string, unknown>) => Promise<void>;

interface JobOptions {
  delay?: number;
  jobId?: string;
}

interface QueueInterface {
  add(name: string, data: Record<string, unknown>, opts?: JobOptions): Promise<void>;
  remove(jobId: string): Promise<void>;
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
    async add(name, data, opts) {
      await q.add(name, data, {
        delay: opts?.delay,
        jobId: opts?.jobId,
        removeOnComplete: true,
        removeOnFail: 5,
      });
    },
    async remove(jobId) {
      const job = await q.getJob(jobId);
      if (job) await job.remove();
    },
    async close() {
      await w.close();
      await q.close();
    },
  };
}

function createInMemoryQueue(): QueueInterface {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    async add(name, data, opts) {
      const run = () => {
        const handler = handlers.get(name);
        if (handler) {
          handler(data).catch((err) =>
            console.error(`Job ${name} failed:`, err),
          );
        }
        if (opts?.jobId) timers.delete(opts.jobId);
      };
      if (opts?.delay && opts.delay > 0) {
        if (opts.jobId) {
          const existing = timers.get(opts.jobId);
          if (existing) clearTimeout(existing);
        }
        const t = setTimeout(run, opts.delay);
        if (opts.jobId) timers.set(opts.jobId, t);
      } else {
        run();
      }
    },
    async remove(jobId) {
      const t = timers.get(jobId);
      if (t) {
        clearTimeout(t);
        timers.delete(jobId);
      }
    },
    async close() {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
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
