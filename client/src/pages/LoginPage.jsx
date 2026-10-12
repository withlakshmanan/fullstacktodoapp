import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  if (ready && user) return <Navigate to="/todos" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/todos", { replace: true });
    } catch (err) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="card">
      <h2>Log in</h2>
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <p className="banner error">{error}</p>}
        <label className="field">
          Email
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={saving}
          />
        </label>
        <label className="field">
          Password
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={saving}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p className="muted">
        No account yet? <Link to="/register">Create one</Link>
      </p>
    </main>
  );
}
