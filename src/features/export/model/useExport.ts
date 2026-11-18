import { useStudio } from "../../../shared/useStudio";
import { textContent } from "../lib/text";
import { download, exportName } from "../lib/download";
import { drawGrid } from "../../preview";
export function useExport() {
  const { doc, notice, busy } = useStudio();
  function ready() {
    return doc.grid && doc.grid.revision === doc.revision && !busy.value;
  }
  function saveText() {
    if (!ready()) return;
    download(
      new Blob([textContent(doc.grid!)], { type: "text/plain;charset=utf-8" }),
      exportName(doc.asset?.name ?? "art", "txt"),
    );
    notice.value = "文本已导出";
  }
  async function copy() {
    if (!ready()) return;
    try {
      await navigator.clipboard.writeText(textContent(doc.grid!));
      notice.value = "字符画已复制";
    } catch {
      notice.value = "无法访问剪贴板，请使用文本导出";
    }
  }
  function png() {
    if (!ready()) return;
    const c = document.createElement("canvas");
    drawGrid(c, doc.grid!, doc.settings.color, doc.settings.background);
    c.toBlob((b) => {
      if (b) download(b, exportName(doc.asset?.name ?? "art", "png"));
    }, "image/png");
  }
  return { doc, busy, ready, saveText, copy, png };
}
