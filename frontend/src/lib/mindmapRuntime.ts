export const MINDMAP_EDITOR_UNAVAILABLE_MESSAGE =
  "生产环境暂不提供旧版思维导图编辑器，已有导图仍可预览。";

export function isMindmapEditorRuntimeAvailable(
  appEnv = process.env.REACT_APP_ENV,
): boolean {
  return appEnv !== "production";
}
