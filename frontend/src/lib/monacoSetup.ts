import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";

let configured = false;

export function configureMonaco(): void {
  if (configured) return;
  configured = true;

  if (typeof window === "undefined") return;

  (window as Window & typeof globalThis & { MonacoEnvironment?: { getWorker?: (...args: unknown[]) => Worker | Promise<Worker> } }).MonacoEnvironment = {
    getWorker(...args: unknown[]) {
      const label = String(args[1] ?? "");
      switch (label) {
        case "json":
          return new JsonWorker();
        case "css":
        case "scss":
        case "less":
          return new CssWorker();
        case "html":
        case "handlebars":
        case "razor":
          return new HtmlWorker();
        case "typescript":
        case "javascript":
          return new TsWorker();
        default:
          return new EditorWorker();
      }
    },
  };
}

export { monaco };
