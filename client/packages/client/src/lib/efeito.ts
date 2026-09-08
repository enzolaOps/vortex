import { useSyncExternalStore } from "react";

function lerReducao(): boolean {
  if (typeof matchMedia !== "function") return true;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function assinarReducao(cb: () => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useReduzirMovimento(): boolean {
  return useSyncExternalStore(assinarReducao, lerReducao, () => true);
}

export function temaDoDocumento(): "dark" | "light" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
