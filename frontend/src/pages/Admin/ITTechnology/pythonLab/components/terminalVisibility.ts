export function canFocusTerminal(container: HTMLElement | null): boolean {
  if (!container?.isConnected) return false;
  return !container.closest('[inert], [aria-hidden="true"]');
}
