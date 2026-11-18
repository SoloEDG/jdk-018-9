export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function exportName(name: string, extension: string) {
  return (
    name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]/gu, "_") +
    "-ascii." +
    extension
  );
}
