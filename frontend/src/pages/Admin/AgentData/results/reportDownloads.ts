import dayjs from "dayjs";
import { safeFilePart } from "../normalize";

export function reportDownloads(
  prefix: string,
  title: string,
  createdAt: string | undefined,
  html: () => string[],
  markdown: () => string[],
) {
  const filename = `${prefix}_${safeFilePart(title)}_${dayjs(createdAt).format("YYYYMMDD")}`;
  const types = [
    { label: "HTML 报告", ext: "html", mime: "text/html;charset=utf-8", content: html },
    { label: "Markdown", ext: "md", mime: "text/markdown;charset=utf-8", content: markdown },
  ];
  return types.map(({ label, ext, mime, content }) => ({
    label,
    ext,
    action: () => {
      const url = URL.createObjectURL(new Blob([content().join("\n")], { type: mime }));
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename}.${ext}`;
        link.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    },
  }));
}
