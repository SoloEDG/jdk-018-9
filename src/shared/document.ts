export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Asset {
  name: string;
  url: string;
  width: number;
  height: number;
  image: HTMLImageElement;
}
export interface Settings {
  columns: number;
  charset: string;
  custom: string;
  contrast: number;
  gamma: number;
  invert: boolean;
  color: boolean;
  background: string;
}
export interface Cell {
  glyph: string;
  color: string;
}
export interface Grid {
  columns: number;
  rows: number;
  cells: Cell[];
  revision: number;
}
export interface FramePoint {
  x: number;
  y: number;
}
/** 锚点：frame 为原始帧归一化坐标（未镜像），art 为该路作品区域坐标 */
export interface CalibrationAnchor {
  frame: FramePoint;
  art: FramePoint;
}
/** 一路摄像头定格时的完整采样依据 */
export interface ChannelSnapshot {
  label: string;
  mirror: boolean;
  crop: Crop;
  anchors: CalibrationAnchor[];
  frameUrl: string;
  width: number;
  height: number;
  capturedAt: number;
}
/** 一次触发确认的采集结果：原始帧 + 校准变换 + 字符网格绑定保存 */
export interface CaptureRecord {
  id: number;
  createdAt: number;
  mode: "compare" | "stitch" | "single";
  left: ChannelSnapshot | null;
  right: ChannelSnapshot | null;
  deltaMs: number | null;
  synced: boolean;
  assetUrl: string;
  assetWidth: number;
  assetHeight: number;
  color: boolean;
  background: string;
  grid: Grid;
}
export interface StudioDocument {
  asset: Asset | null;
  crop: Crop;
  settings: Settings;
  grid: Grid | null;
  capture: CaptureRecord | null;
  revision: number;
}
