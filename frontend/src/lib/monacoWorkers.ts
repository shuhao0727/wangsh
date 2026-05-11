import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

type MonacoEnvironmentShape = {
  getWorker: (_workerId: string, label: string) => Worker;
};

declare global {
  interface Window {
    MonacoEnvironment?: MonacoEnvironmentShape;
  }
}

function configureMonacoWorkers() {
  if (typeof window === "undefined") return;
  if (window.MonacoEnvironment?.getWorker) return;

  window.MonacoEnvironment = {
    getWorker() {
      // PythonLab only uses Python models, so the generic editor worker avoids
      // shipping JSON/CSS/HTML/TypeScript language workers with this route.
      return new editorWorker();
    },
  };
}

export { configureMonacoWorkers };
