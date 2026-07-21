export interface MindMapNode {
  data: {
    text: string;
    uid?: string;
    [key: string]: unknown;
  };
  children: MindMapNode[];
}

export function normalizeMindMapNodeText(value: unknown): string {
  const raw = typeof value === "string" ? value : String(value ?? "");
  if (!raw) return "";
  const parsed = new DOMParser().parseFromString(
    raw.replace(/<br\s*\/?>/gi, "\n"),
    "text/html",
  );
  return (parsed.body.textContent || raw).replace(/\s+/g, " ").trim();
}

export function markdownToMindMapData(markdown: string, rootText: string): MindMapNode {
  let uid = 0;
  const nextUid = () => `n${++uid}`;
  const lines = markdown.split("\n").filter((line) => line.trim());
  const firstHeading = lines[0]?.match(/^(#+)\s+(.+)/);
  const hasRootHeading = firstHeading?.[1].length === 1;
  const initialRootText = hasRootHeading
    ? normalizeMindMapNodeText(firstHeading[2]) || rootText
    : rootText;
  const root: MindMapNode = {
    data: { text: initialRootText, uid: nextUid() },
    children: [],
  };
  const stack: { level: number; node: MindMapNode }[] = [{ level: 0, node: root }];

  for (const line of hasRootHeading ? lines.slice(1) : lines) {
    const match = line.match(/^(#+)\s+(.+)/);
    if (!match) continue;
    const level = hasRootHeading
      ? Math.max(1, match[1].length - 1)
      : match[1].length;
    const child: MindMapNode = {
      data: {
        text: normalizeMindMapNodeText(match[2]) || "未命名节点",
        uid: nextUid(),
      },
      children: [],
    };
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    if (stack.length > 0) stack[stack.length - 1].node.children.push(child);
    stack.push({ level, node: child });
  }

  return root;
}

export function mindMapDataToMarkdown(node: MindMapNode, level = 1): string {
  const text = normalizeMindMapNodeText(node.data.text) || "未命名节点";
  let markdown = `${"#".repeat(level)} ${text}\n`;
  for (const child of node.children) {
    markdown += mindMapDataToMarkdown(child, level + 1);
  }
  return markdown;
}
