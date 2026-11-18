import type { Asset } from "../../../shared/document";
export async function decodeImage(url: string, name: string): Promise<Asset> {
  const image = new Image();
  image.src = url;
  await image.decode();
  if (
    !image.naturalWidth ||
    image.naturalWidth * image.naturalHeight > 40000000
  )
    throw new Error("图片超过 4000 万像素，请先缩小");
  if (url.startsWith("blob:")) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")!.drawImage(image, 0, 0);
    url = canvas.toDataURL("image/png");
  }
  return {
    name,
    url,
    width: image.naturalWidth,
    height: image.naturalHeight,
    image,
  };
}
