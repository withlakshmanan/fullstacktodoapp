export default function AboutPage() {
  return (
    <section className="card">
      <h2>About</h2>
      <p className="muted">
        Frontend: React + Vite. Backend: Node.js + Express. Database: PostgreSQL.
      </p>
      <p className="muted">
        Sign in with email and password. Each account has its own todo list.
      </p>
      <p className="muted">
        Side effects are published to a PostgreSQL job queue in the same transaction as the
        write, then handled by a background worker:
      </p>
      <ul className="muted about-list">
        <li>A welcome note when you sign up.</li>
        <li>An activity entry when a todo is added, completed, reopened, or deleted.</li>
        <li>A delayed reminder if a new todo is still open after a short wait.</li>
      </ul>
    </section>
  );
}
