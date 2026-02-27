import fs from "fs";
import path from "path";

const readChatAreaSource = () => {
  const filePath = path.join(__dirname, "ChatArea.tsx");
  return fs.readFileSync(filePath, "utf8");
};

test("ChatArea wires normalizeMarkdown into the ReactMarkdown render chain", () => {
  const src = readChatAreaSource();
  expect(src).toContain('import { normalizeMarkdown } from "@utils/normalizeMarkdown"');
  expect(src).toContain("{normalizeMarkdown(message.content || \"\")}");
});

test("ChatArea enables KaTeX rendering plugins (remark-math + rehype-katex)", () => {
  const src = readChatAreaSource();
  expect(src).toContain('import remarkMath from "remark-math"');
  expect(src).toContain('import rehypeKatex from "rehype-katex"');
  expect(src).toContain("remarkPlugins={[remarkGfm, remarkMath]}");
  expect(src).toContain("rehypePlugins={[rehypeKatex]}");
});

test("ChatArea renders streaming content through the same MessageBubble component", () => {
  const src = readChatAreaSource();
  expect(src).toContain("visibleMessages.map((message) =>");
  expect(src).toContain("<MessageBubble");
  expect(src).toContain("isStreaming && (");
  expect(src).toContain("id: 'streaming-temp'");
});

