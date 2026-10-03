/** True when keystrokes in this element are text input, not note keys. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    return true;
  if (target instanceof HTMLInputElement) {
    // Radios, sliders and checkboxes don't consume letter keys.
    return !["radio", "range", "checkbox", "button"].includes(target.type);
  }
  return false;
}
