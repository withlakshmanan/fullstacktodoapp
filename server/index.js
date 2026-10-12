import cors from "cors";
import express from "express";
import { checkPassword, hashPassword, publicUser, requireAuth, signToken, validateCredentials } from "./auth.js";
import { pool } from "./db.js";
import { jobHandlers } from "./jobs.js";
import { enqueue, REMINDER_DELAY_MS, startWorker } from "./queue.js";

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set. Add it to server/.env.");
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", async (req, res) => {
  const parsed = validateCredentials(req.body?.email, req.body?.password);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const passwordHash = await hashPassword(parsed.password);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE users IN EXCLUSIVE MODE");
    const { rows: counts } = await client.query(`SELECT COUNT(*)::int AS count FROM users`);
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email`,
      [parsed.email, passwordHash]
    );
    if (counts[0].count === 0) {
      await client.query(`UPDATE todos SET user_id = $1 WHERE user_id IS NULL`, [rows[0].id]);
    }
    await enqueue(client, {
      queue: "notifications",
      name: "user.registered",
      payload: { userId: rows[0].id, email: rows[0].email },
    });
    await client.query("COMMIT");
    const user = publicUser(rows[0]);
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create account" });
  } finally {
    client.release();
  }
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = validateCredentials(req.body?.email, req.body?.password);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, email, password_hash FROM users WHERE email = $1`,
      [parsed.email]
    );
    const row = rows[0];
    const ok = await checkPassword(parsed.password, row?.password_hash);
    if (!row || !ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const user = publicUser(row);
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to log in" });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, email FROM users WHERE id = $1`, [req.user.id]);
    if (!rows[0]) {
      return res.status(401).json({ error: "Authentication required" });
    }
    res.json(publicUser(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load account" });
  }
});

app.get("/api/todos", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, completed, created_at AS "createdAt"
       FROM todos
       WHERE user_id = $1
       ORDER BY created_at ASC, id ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load todos" });
  }
});

app.post("/api/todos", requireAuth, async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO todos (title, user_id) VALUES ($1, $2)
       RETURNING id, title, completed, created_at AS "createdAt"`,
      [title, req.user.id]
    );
    const todo = rows[0];
    await enqueue(client, {
      queue: "notifications",
      name: "todo.created",
      payload: { userId: req.user.id, todoId: todo.id, title: todo.title },
    });
    await enqueue(client, {
      queue: "reminders",
      name: "todo.due",
      payload: { userId: req.user.id, todoId: todo.id },
      runAt: new Date(Date.now() + REMINDER_DELAY_MS),
    });
    await client.query("COMMIT");
    res.status(201).json(todo);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create todo" });
  } finally {
    client.release();
  }
});

app.patch("/api/todos/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "invalid id" });
  }

  const { title, completed } = req.body ?? {};
  const updates = [];
  const values = [];
  let i = 1;

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "title must be a non-empty string" });
    }
    updates.push(`title = $${i++}`);
    values.push(title.trim());
  }
  if (completed !== undefined) {
    if (typeof completed !== "boolean") {
      return res.status(400).json({ error: "completed must be a boolean" });
    }
    updates.push(`completed = $${i++}`);
    values.push(completed);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "no fields to update" });
  }

  values.push(id, req.user.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: existing } = await client.query(
      `SELECT id, completed FROM todos WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [id, req.user.id]
    );
    if (!existing[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "not found" });
    }

    const { rows } = await client.query(
      `UPDATE todos SET ${updates.join(", ")}
       WHERE id = $${i++} AND user_id = $${i}
       RETURNING id, title, completed, created_at AS "createdAt"`,
      values
    );
    const todo = rows[0];
    if (completed !== undefined && completed !== existing[0].completed) {
      await enqueue(client, {
        queue: "notifications",
        name: todo.completed ? "todo.completed" : "todo.reopened",
        payload: { userId: req.user.id, todoId: todo.id, title: todo.title },
      });
    }
    await client.query("COMMIT");
    res.json(todo);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to update todo" });
  } finally {
    client.release();
  }
});

app.delete("/api/todos/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "invalid id" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING id, title`,
      [id, req.user.id]
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "not found" });
    }
    await enqueue(client, {
      queue: "notifications",
      name: "todo.deleted",
      payload: { userId: req.user.id, todoId: rows[0].id, title: rows[0].title },
    });
    await client.query("COMMIT");
    res.status(204).send();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to delete todo" });
  } finally {
    client.release();
  }
});

app.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, kind, message, created_at AS "createdAt"
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 20`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

startWorker(pool, jobHandlers);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
