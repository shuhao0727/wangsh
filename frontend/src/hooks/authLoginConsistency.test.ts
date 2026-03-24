import fs from "fs";
import path from "path";

const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

test("useAuth.getToken reads token from storage or cookie fallback", () => {
  const src = readSource("hooks/useAuth.ts");
  expect(src).toContain("getStoredAccessToken() || getCookieToken()");
});

test("Login page checks admin role from login result user", () => {
  const src = readSource("pages/Auth/Login.tsx");
  expect(src).toContain("res.user?.role_code");
  expect(src).toContain("role === \"admin\" || role === \"super_admin\"");
});

test("Admin login modal checks admin role from login result user", () => {
  const src = readSource("layouts/AdminLayout.tsx");
  expect(src).toContain("res.user?.role_code");
  expect(src).toContain("role === \"admin\" || role === \"super_admin\"");
});

test("Shared LoginForm checks admin role from login result user", () => {
  const src = readSource("components/Auth/LoginForm.tsx");
  expect(src).toContain("result.user?.role_code");
  expect(src).toContain("role === \"admin\" || role === \"super_admin\"");
});

test("AIAgents login-draft auto send relies on fresh login result", () => {
  const src = readSource("pages/AIAgents/index.tsx");
  expect(src).toContain("if (draftMessage && currentAgent && result.user)");
});

