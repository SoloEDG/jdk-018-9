import type { CalibrationAnchor, Crop } from "../../../shared/document";
import { applyTransform, fitTransform, type Pt } from "./transform";

/** 锚点依次对应的作品区域角点：左上 → 右上 → 右下 → 左下 */
export const ART_CORNERS: Pt[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
export const ART_CORNER_NAMES = ["左上", "右上", "右下", "左下"];
export const MAX_ANCHORS = 4;

/**
 * 屏幕（预览可能经 CSS 镜像）坐标 → 原始帧坐标。
 * 屏幕上镜像后的框/点不能直接当成原始采样位置，必须先还原。
 */
export function screenToFrame(p: Pt, mirror: boolean): Pt {
  return { x: mirror ? 1 - p.x : p.x, y: p.y };
}
/** 原始帧坐标 → 屏幕坐标（镜像为对合变换，与上式相同） */
export function frameToScreen(p: Pt, mirror: boolean): Pt {
  return screenToFrame(p, mirror);
}
/** 屏幕上的裁剪框（已镜像显示）→ 原始帧坐标下的裁剪框 */
export function screenCropToFrame(c: Crop, mirror: boolean): Crop {
  return {
    x: mirror ? 1 - c.x - c.width : c.x,
    y: c.y,
    width: c.width,
    height: c.height,
  };
}
/** 原始帧坐标下的裁剪框 → 屏幕显示位置 */
export function frameCropToScreen(c: Crop, mirror: boolean): Crop {
  return screenCropToFrame(c, mirror);
}

export interface ChannelCalibration {
  crop: Crop;
  anchors: CalibrationAnchor[];
}

/**
 * 作品区域坐标 [0,1]² → 原始帧归一化坐标。
 * 锚点 ≥2 时由锚点拟合的变换决定采样位置（裁剪框不再参与）；
 * 否则退化为轴对齐裁剪框映射。全部在原始帧坐标系中进行，与屏幕镜像无关。
 */
export function artToFrameMapper(ch: ChannelCalibration): (art: Pt) => Pt {
  if (ch.anchors.length >= 2) {
    const t = fitTransform(
      ART_CORNERS.slice(0, ch.anchors.length),
      ch.anchors.map((a) => a.frame),
    );
    if (t) return (art) => applyTransform(t, art);
  }
  const c = ch.crop;
  return (art) => ({ x: c.x + art.x * c.width, y: c.y + art.y * c.height });
}

/** 该路采样区域在原始帧中的宽高比（用于拼接布局） */
export function regionAspect(
  ch: ChannelCalibration,
  frameWidth: number,
  frameHeight: number,
): number {
  let w: number, h: number;
  if (ch.anchors.length >= 2) {
    const xs = ch.anchors.map((a) => a.frame.x);
    const ys = ch.anchors.map((a) => a.frame.y);
    w = (Math.max(...xs) - Math.min(...xs)) * frameWidth;
    h = (Math.max(...ys) - Math.min(...ys)) * frameHeight;
  } else {
    w = ch.crop.width * frameWidth;
    h = ch.crop.height * frameHeight;
  }
  if (w <= 0 || h <= 0) return 1;
  return Math.min(20, Math.max(0.05, w / h));
}
