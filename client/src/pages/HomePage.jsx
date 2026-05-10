import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <section className="card">
      <h2>Welcome</h2>
      <p className="muted">
        This is your full-stack todo app powered by React, Express, and PostgreSQL.
      </p>
      <p className="muted">
        Start managing tasks from the <Link to="/todos">Todos page</Link>.
      </p>
    </section>
  );
}
