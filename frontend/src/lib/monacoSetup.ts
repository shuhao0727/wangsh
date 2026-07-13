import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import { configureMonacoWorkers } from "./monacoWorkers";

let configured = false;

export function configureMonaco(): void {
  if (configured || typeof window === "undefined") return;

  configureMonacoWorkers();
  loader.config({ monaco });
  configured = true;
}

export { monaco };
