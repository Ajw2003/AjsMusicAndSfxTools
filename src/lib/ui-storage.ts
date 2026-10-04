/** Read a saved UI choice; storage can be missing or blocked. */
export function loadUi(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`Could not read ${key}:`, error);
    return null;
  }
}

export function saveUi(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (error) {
    // A layout preference is a convenience; losing it must not break anything.
    console.warn(`Could not save ${key}:`, error);
  }
}
