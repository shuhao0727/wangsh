type KeyboardMeta = {
  key: string;
  isComposing?: boolean;
  keyCode?: number;
};

const DELETE_SHORTCUT_KEYS = new Set(["Delete", "Backspace"]);
const MONACO_BLOCK_KEYS = new Set(["Enter", "Delete"]);

function toElement(target: EventTarget | Element | null | undefined): Element | null {
  if (!target) return null;
  if (target instanceof Element) return target;
  return null;
}

function isImeComposing(meta: KeyboardMeta): boolean {
  return meta.isComposing === true || meta.keyCode === 229;
}

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "INPUT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.closest(".monaco-editor")) return true;
  if (el.getAttribute("role") === "textbox") return true;
  return false;
}

export function shouldHandleCanvasDeleteShortcut(input: {
  key: string;
  isComposing?: boolean;
  keyCode?: number;
  defaultPrevented?: boolean;
  target: EventTarget | null;
  activeElement: Element | null;
  hasSelection: boolean;
}): boolean {
  if (!DELETE_SHORTCUT_KEYS.has(input.key)) return false;
  if (isImeComposing(input)) return false;
  if (input.defaultPrevented) return false;
  if (!input.hasSelection) return false;
  const targetEl = toElement(input.target);
  if (isEditableElement(targetEl)) return false;
  if (isEditableElement(input.activeElement)) return false;
  return true;
}

export function shouldStopMonacoEditorKeyPropagation(meta: KeyboardMeta): boolean {
  if (!MONACO_BLOCK_KEYS.has(meta.key)) return false;
  if (isImeComposing(meta)) return false;
  return true;
}
