/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: string;
  readonly VITE_API_URL: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_DIFY_URL: string;
  readonly VITE_NAS_URL: string;
  readonly VITE_DEBUG_LOG: string;
  readonly VITE_PYTHONLAB_RUNTIME: string;
  readonly VITE_PYODIDE_BASE_URL: string;
  readonly VITE_PYTHONLAB_DEBUG_FRONTEND_MODE: string;
  // 兼容 CRA 的 REACT_APP_* 前缀（过渡期）
  readonly REACT_APP_ENV: string;
  readonly REACT_APP_API_URL: string;
  readonly REACT_APP_VERSION: string;
  readonly REACT_APP_DIFY_URL: string;
  readonly REACT_APP_NAS_URL: string;
  readonly REACT_APP_DEBUG_LOG: string;
  readonly REACT_APP_PYTHONLAB_RUNTIME: string;
  readonly REACT_APP_PYODIDE_BASE_URL: string;
  readonly REACT_APP_PYTHONLAB_DEBUG_FRONTEND_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
