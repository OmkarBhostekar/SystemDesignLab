"use client";

import { useEffect, useSyncExternalStore } from "react";

const FOCUS_MODE_STORAGE_KEY = "system-design-lab:focus-mode";
const FOCUS_MODE_CHANGE_EVENT = "system-design-lab:focus-mode-change";
let volatileFocusMode = false;

function applyFocusMode(active: boolean) {
  document.documentElement.dataset.focusMode = active ? "true" : "false";
}

function getFocusModeSnapshot() {
  try {
    return window.localStorage.getItem(FOCUS_MODE_STORAGE_KEY) === "true";
  } catch {
    return volatileFocusMode;
  }
}

function subscribeToFocusMode(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === FOCUS_MODE_STORAGE_KEY) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(FOCUS_MODE_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(FOCUS_MODE_CHANGE_EVENT, onStoreChange);
  };
}

export function FocusModeToggle() {
  const active = useSyncExternalStore(subscribeToFocusMode, getFocusModeSnapshot, () => false);

  useEffect(() => applyFocusMode(active), [active]);

  function toggleFocusMode() {
    const nextActive = !active;

    volatileFocusMode = nextActive;
    applyFocusMode(nextActive);

    try {
      window.localStorage.setItem(FOCUS_MODE_STORAGE_KEY, String(nextActive));
    } catch {
      // The in-memory toggle still works for the current page.
    }

    window.dispatchEvent(new Event(FOCUS_MODE_CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      className="focus-mode-toggle"
      aria-pressed={active}
      onClick={toggleFocusMode}
    >
      <span className="focus-mode-toggle__icon" aria-hidden="true">
        {active ? "×" : "⌗"}
      </span>
      <span>{active ? "Exit focus mode" : "Focus mode"}</span>
    </button>
  );
}
