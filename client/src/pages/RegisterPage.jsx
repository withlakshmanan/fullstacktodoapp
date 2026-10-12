import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function RegisterPage() {
  const { user, ready, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  if (ready && user) return <Navigate to="/todos" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await register(email, password);
      navigate("/todos", { replace: true });
    } catch (err) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="card">
      <h2>Create account</h2>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            disabled={saving}
          />
        </label>
        <label className="field">
          Confirm password
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
            disabled={saving}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="muted">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </main>
  );
}
