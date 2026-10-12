import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const TOKEN_TTL = "7d";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const dummyHash = bcrypt.hashSync("not-a-real-password", 12);

export function publicUser(user) {
  return { id: user.id, email: user.email };
}

export function validateCredentials(email, password) {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  const pwd = typeof password === "string" ? password : "";

  if (!EMAIL_RE.test(normalized) || normalized.length > 255) {
    return { error: "Enter a valid email address" };
  }
  if (pwd.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }
  if (pwd.length > 72) {
    return { error: "Password must be at most 72 characters" };
  }
  return { email: normalized, password: pwd };
}

export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function checkPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash || dummyHash);
}

export function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign({ email: user.email }, secret, {
    subject: String(user.id),
    expiresIn: TOKEN_TTL,
  });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.user = { id, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
