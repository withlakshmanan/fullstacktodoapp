import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function HomePage() {
  const { user, ready } = useAuth();

  return (
    <section className="card">
      <h2>Welcome</h2>
      <p className="muted">
        This is your full-stack todo app powered by React, Express, and PostgreSQL.
      </p>
      {ready && user ? (
        <p className="muted">
          Signed in as {user.email}. Open your <Link to="/todos">todo list</Link>.
        </p>
      ) : (
        <p className="muted">
          <Link to="/login">Log in</Link> or <Link to="/register">create an account</Link> to
          manage your tasks.
        </p>
      )}
    </section>
  );
}
