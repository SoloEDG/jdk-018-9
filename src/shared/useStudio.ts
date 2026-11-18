import { inject } from "vue";
import { studioKey } from "./context";
export function useStudio() {
  const ctx = inject(studioKey);
  if (!ctx) throw new Error("Missing studio");
  return ctx;
}
