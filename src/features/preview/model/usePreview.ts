import { ref, computed } from "vue";
import { useStudio } from "../../../shared/useStudio";
export function usePreview() {
  const { doc, busy } = useStudio();
  const mode = ref<"art" | "text">("art");
  const zoom = ref(100);
  const count = computed(() => doc.grid?.cells.length.toLocaleString() ?? "0");
  return { doc, busy, mode, zoom, count };
}
