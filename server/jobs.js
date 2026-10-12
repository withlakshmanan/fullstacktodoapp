import { pool } from "./db.js";

async function notify({ userId, kind, message, jobId }) {
  await pool.query(
    `INSERT INTO notifications (user_id, kind, message, job_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (job_id) DO NOTHING`,
    [userId, kind, message, jobId]
  );
}

export const jobHandlers = {
  // Sent after signup so the HTTP response does not wait on the side effect.
  "notifications.user.registered": (job) =>
    notify({
      userId: job.payload.userId,
      kind: "welcome",
      message: `Welcome ${job.payload.email}. Your list is ready.`,
      jobId: job.id,
    }),

  "notifications.todo.created": (job) =>
    notify({
      userId: job.payload.userId,
      kind: "todo.created",
      message: `Added “${job.payload.title}”.`,
      jobId: job.id,
    }),

  "notifications.todo.completed": (job) =>
    notify({
      userId: job.payload.userId,
      kind: "todo.completed",
      message: `Completed “${job.payload.title}”.`,
      jobId: job.id,
    }),

  "notifications.todo.reopened": (job) =>
    notify({
      userId: job.payload.userId,
      kind: "todo.reopened",
      message: `Reopened “${job.payload.title}”.`,
      jobId: job.id,
    }),

  "notifications.todo.deleted": (job) =>
    notify({
      userId: job.payload.userId,
      kind: "todo.deleted",
      message: `Deleted “${job.payload.title}”.`,
      jobId: job.id,
    }),

  // Delayed job. No-ops if the todo was completed or deleted before it ran.
  "reminders.todo.due": async (job) => {
    const { rows } = await pool.query(
      `SELECT title, completed FROM todos WHERE id = $1 AND user_id = $2`,
      [job.payload.todoId, job.payload.userId]
    );
    const todo = rows[0];
    if (!todo || todo.completed) return;
    await notify({
      userId: job.payload.userId,
      kind: "reminder",
      message: `Still open: “${todo.title}”.`,
      jobId: job.id,
    });
  },
};
