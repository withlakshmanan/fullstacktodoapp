import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import AboutPage from "./pages/AboutPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import TodosPage from "./pages/TodosPage.jsx";

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

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/todos" element={<TodosPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
