import { NavLink, Outlet } from "react-router-dom";
import "./App.css";

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>Todos</h1>
        <p className="subtitle">React · Express · PostgreSQL</p>
      </header>

      <nav className="tabs" aria-label="Primary">
        <NavLink to="/" className={({ isActive }) => (isActive ? "tab active" : "tab")} end>
          Home
        </NavLink>
        <NavLink to="/todos" className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          Todos
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          About
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}
