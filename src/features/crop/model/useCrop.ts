import { ref } from "vue";
import { useStudio } from "../../../shared/useStudio";
import { cropFromPoints, normalizeCrop } from "../lib/geometry";
export function useCrop() {
  const { doc, invalidate } = useStudio();
  const draft = ref(doc.crop);
  const start = ref<{ x: number; y: number } | null>(null);
  function point(e: PointerEvent) {
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
      y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)),
    };
  }
  function down(e: PointerEvent) {
    start.value = point(e);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!start.value) return;
    const p = point(e);
    draft.value = cropFromPoints(start.value.x, start.value.y, p.x, p.y);
  }
  function up(e: PointerEvent) {
    if (!start.value) return;
    move(e);
    doc.crop = normalizeCrop(draft.value);
    start.value = null;
    invalidate();
  }
  function reset() {
    start.value = null;
    doc.crop = { x: 0, y: 0, width: 1, height: 1 };
    invalidate();
  }
  return { doc, draft, start, down, move, up, reset };
}
