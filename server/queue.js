const workerId = `api-${process.pid}`;
const STALE_LOCK = "30 seconds";

export const REMINDER_DELAY_MS = Number(process.env.REMINDER_DELAY_MS) || 20_000;

/**
 * Publish a job. Pass a transaction client so the job commits with the
 * business write (transactional outbox).
 */
export async function enqueue(db, { queue, name, payload, runAt, maxAttempts = 5 }) {
  await db.query(
    `INSERT INTO jobs (queue, name, payload, run_at, max_attempts)
     VALUES ($1, $2, $3::jsonb, $4, $5)`,
    [queue, name, JSON.stringify(payload ?? {}), runAt ?? new Date(), maxAttempts]
  );
}

export function startWorker(pool, handlers, { pollMs = 1000 } = {}) {
  let stopped = false;
  let timer;
  let missingSchemaLogged = false;

  async function tick() {
    if (stopped) return;
    try {
      await releaseStaleLocks(pool);
      const job = await claimNext(pool);
      if (job) await processJob(pool, handlers, job);
    } catch (err) {
      if (err.code === "42P01") {
        if (!missingSchemaLogged) {
          console.error("Job tables are missing. From server/, run: npm run db:init");
          missingSchemaLogged = true;
        }
      } else {
        console.error("queue worker error", err);
      }
    } finally {
      if (!stopped) timer = setTimeout(tick, pollMs);
    }
  }

  tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

async function releaseStaleLocks(pool) {
  await pool.query(
    `UPDATE jobs
     SET status = 'pending', locked_at = NULL, locked_by = NULL
     WHERE status = 'processing'
       AND locked_at < NOW() - $1::interval`,
    [STALE_LOCK]
  );
}

async function claimNext(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `WITH next AS (
         SELECT id
         FROM jobs
         WHERE status = 'pending' AND run_at <= NOW()
         ORDER BY run_at ASC, id ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE jobs
       SET status = 'processing',
           locked_at = NOW(),
           locked_by = $1,
           attempts = jobs.attempts + 1
       FROM next
       WHERE jobs.id = next.id
       RETURNING jobs.id, jobs.queue, jobs.name, jobs.payload,
                 jobs.attempts, jobs.max_attempts AS "maxAttempts"`,
      [workerId]
    );
    await client.query("COMMIT");
    return rows[0] ?? null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function processJob(pool, handlers, job) {
  const key = `${job.queue}.${job.name}`;
  const handler = handlers[key];
  try {
    if (!handler) throw new Error(`No handler for ${key}`);
    await handler(job);
    await pool.query(
      `UPDATE jobs
       SET status = 'completed', finished_at = NOW(), locked_at = NULL, last_error = NULL
       WHERE id = $1`,
      [job.id]
    );
    console.log(`queue completed ${key} #${job.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (job.attempts < job.maxAttempts) {
      const delaySeconds = Math.min(60, 2 ** job.attempts);
      await pool.query(
        `UPDATE jobs
         SET status = 'pending',
             locked_at = NULL,
             locked_by = NULL,
             last_error = $2,
             run_at = NOW() + ($3 || ' seconds')::interval
         WHERE id = $1`,
        [job.id, message, String(delaySeconds)]
      );
      console.error(`queue retry ${key} #${job.id} in ${delaySeconds}s: ${message}`);
    } else {
      await pool.query(
        `UPDATE jobs
         SET status = 'failed', finished_at = NOW(), locked_at = NULL, last_error = $2
         WHERE id = $1`,
        [job.id, message]
      );
      console.error(`queue failed ${key} #${job.id}: ${message}`);
    }
  }
}
