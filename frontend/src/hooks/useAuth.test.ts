import fs from "fs";
import path from "path";

const readUseAuthSource = () => {
  const filePath = path.join(__dirname, "useAuth.ts");
  return fs.readFileSync(filePath, "utf8");
};

test("useAuth listens global auth-expired event", () => {
  const src = readUseAuthSource();
  expect(src).toContain("AUTH_EXPIRED_EVENT");
  expect(src).toContain("window.addEventListener(AUTH_EXPIRED_EVENT");
  expect(src).toContain("isAuthenticated: false");
  expect(src).toContain("登录已过期，请重新登录");
});

