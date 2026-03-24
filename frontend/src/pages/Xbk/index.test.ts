import fs from "fs";
import path from "path";

const readPageSource = () => {
  const filePath = path.join(__dirname, "index.tsx");
  return fs.readFileSync(filePath, "utf8");
};

test("XBK selections virtual rows use create flow instead of edit update", () => {
  const src = readPageSource();
  expect(src).toContain("isVirtualSelection ? \"create\" : \"edit\"");
  expect(src).toContain("record?.course_code === \"休学或其他\" || record?.course_code === \"未选\"");
});

test("XBK selections virtual rows do not expose delete action", () => {
  const src = readPageSource();
  expect(src).toContain("{isVirtualSelection ? \"补录\" : \"编辑\"}");
  expect(src).toContain("!isVirtualSelection && (");
});

test("XBK selections table uses unique rowKey for virtual rows", () => {
  const src = readPageSource();
  expect(src).toContain("virtual-${record.year}-${record.term}-${record.student_no}-${record.course_code || \"\"}");
});

