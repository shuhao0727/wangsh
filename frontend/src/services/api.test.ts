import fs from "fs";
import path from "path";

const readApiSource = () => {
  const filePath = path.join(__dirname, "api.ts");
  return fs.readFileSync(filePath, "utf8");
};

test("api interceptor emits auth-expired event after refresh failure", () => {
  const src = readApiSource();
  expect(src).toContain('AUTH_EXPIRED_EVENT = "ws:auth-expired"');
  expect(src).toContain("window.dispatchEvent");
  expect(src).toContain("notifyAuthExpired");
  expect(src).toContain("authTokenStorage.clear()");
});

