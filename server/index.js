import cors from "cors";
import express from "express";
import { pool } from "./db.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/todos", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, completed, created_at AS "createdAt"
       FROM todos
       ORDER BY created_at ASC, id ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load todos" });
  }
});

app.post("/api/todos", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO todos (title) VALUES ($1)
       RETURNING id, title, completed, created_at AS "createdAt"`,
      [title]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create todo" });
  }
});

app.patch("/api/todos/:id", async (req, res) => {
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

  values.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE todos SET ${updates.join(", ")}
       WHERE id = $${i}
       RETURNING id, title, completed, created_at AS "createdAt"`,
      values
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update todo" });
  }
});

app.delete("/api/todos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "invalid id" });
  }
  try {
    const { rowCount } = await pool.query(`DELETE FROM todos WHERE id = $1`, [id]);
    if (!rowCount) {
      return res.status(404).json({ error: "not found" });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete todo" });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
