import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

export default function TodosPage() {
  const { logout } = useAuth();
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const ensureOk = useCallback(
    async (res, fallback) => {
      if (res.status === 401) {
        logout();
        return false;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || fallback);
      }
      return true;
    },
    [logout]
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api("/api/todos");
      if (!(await ensureOk(res, "Could not load todos"))) return;
      setTodos(await res.json());
    } catch (e) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [ensureOk]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api("/api/todos", {
        method: "POST",
        body: JSON.stringify({ title: trimmed }),
      });
      if (!(await ensureOk(res, "Could not add todo"))) return;
      const created = await res.json();
      setTodos((prev) => [...prev, created]);
      setTitle("");
    } catch (e) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTodo(todo) {
    setError(null);
    try {
      const res = await api(`/api/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !todo.completed }),
      });
      if (!(await ensureOk(res, "Could not update todo"))) return;
      const updated = await res.json();
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (e) {
      setError(e.message ?? "Something went wrong");
    }
  }

  async function deleteTodo(id) {
    setError(null);
    try {
      const res = await api(`/api/todos/${id}`, { method: "DELETE" });
      if (!(await ensureOk(res, "Could not delete todo"))) return;
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e.message ?? "Something went wrong");
    }
  }

  return (
    <main className="card">
      <form className="add-form" onSubmit={handleAdd}>
        <input
          className="input"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          disabled={saving}
        />
        <button className="btn btn-primary" type="submit" disabled={saving || !title.trim()}>
          Add
        </button>
      </form>

      {error && <p className="banner error">{error}</p>}

      {loading ? (
        <p className="muted center">Loading...</p>
      ) : todos.length === 0 ? (
        <p className="muted center">No todos yet. Add one above.</p>
      ) : (
        <ul className="list">
          {todos.map((todo) => (
            <li key={todo.id} className={`row ${todo.completed ? "done" : ""}`}>
              <label className="checkbox-label">
                <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo)} />
                <span className="title">{todo.title}</span>
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => deleteTodo(todo.id)}
                aria-label={`Delete ${todo.title}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
