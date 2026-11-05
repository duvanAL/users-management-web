"use client";
import { useSyncExternalStore } from "react";

export type MotionMode = "full" | "reduced" | "system";

const KEY = "motion";
const CHANGE = "motionchange";
const QUERY = "(prefers-reduced-motion: reduce)";

// El script de layout.tsx aplica la misma preferencia antes de pintar
export function motionMode(): MotionMode {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "full" || saved === "reduced" ? saved : "system";
  } catch {
    return "system";
  }
}

export function motionReduced() {
  const mode = motionMode();
  return mode === "system" ? matchMedia(QUERY).matches : mode === "reduced";
}

export function setMotionMode(mode: MotionMode) {
  try {
    if (mode === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {}
  if (mode === "system") delete document.documentElement.dataset.motion;
  else document.documentElement.dataset.motion = mode;
  dispatchEvent(new Event(CHANGE));
}

function subscribe(notify: () => void) {
  const query = matchMedia(QUERY);
  addEventListener(CHANGE, notify);
  query.addEventListener("change", notify);
  return () => {
    removeEventListener(CHANGE, notify);
    query.removeEventListener("change", notify);
  };
}

export const useMotionMode = () =>
  useSyncExternalStore(subscribe, motionMode, () => "system" as MotionMode);

export const useReducedMotion = () =>
  useSyncExternalStore(subscribe, motionReduced, () => false);
