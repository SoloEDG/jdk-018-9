import { ref } from "vue";
import { useStudio } from "../../../shared/useStudio";
import { decodeImage } from "../lib/decode";
import { demoImage } from "../lib/demo";
export function useSource() {
  const { doc, notice, invalidate } = useStudio();
  const loading = ref(false);
  let ticket = 0;
  async function load(url: string, name: string) {
    const id = ++ticket;
    loading.value = true;
    try {
      const asset = await decodeImage(url, name);
      if (id !== ticket) return;
      doc.asset = asset;
      doc.crop = { x: 0, y: 0, width: 1, height: 1 };
      invalidate();
      notice.value = "图片已载入";
    } catch (e) {
      if (id === ticket)
        notice.value = e instanceof Error ? e.message : "无法读取图片";
    } finally {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      if (id === ticket) loading.value = false;
    }
  }
  function file(f?: File) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 20 * 1024 * 1024) {
      notice.value = "请选择 20 MB 以内的 PNG、JPEG 或 WebP 图片";
      return;
    }
    void load(URL.createObjectURL(f), f.name);
  }
  return {
    doc,
    loading,
    file,
    demo: () => load(demoImage(), "Sunset ridge.png"),
  };
}
