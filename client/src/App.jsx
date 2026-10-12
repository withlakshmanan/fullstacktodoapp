import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { useAuth } from "./auth.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import TodosPage from "./pages/TodosPage.jsx";

function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="muted center">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, ready, logout } = useAuth();

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Todos</h1>
          <p className="subtitle">React · Express · PostgreSQL</p>
        </div>
        {ready && (
          <div className="session">
            {user ? (
              <>
                <span className="session-email" title={user.email}>
                  {user.email}
                </span>
                <button type="button" className="btn btn-ghost" onClick={logout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={({ isActive }) => (isActive ? "tab active" : "tab")}>
                  Log in
                </NavLink>
                <NavLink
                  to="/register"
                  className={({ isActive }) => (isActive ? "tab active" : "tab")}
                >
                  Sign up
                </NavLink>
              </>
            )}
          </div>
        )}
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/todos"
          element={
            <ProtectedRoute>
              <TodosPage />
            </ProtectedRoute>
          }
        />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
