import { reactive, ref } from "vue";
import { useStudio } from "../../../shared/useStudio";
import type { StudioContext } from "../../../shared/context";
import type {
  CalibrationAnchor,
  CaptureRecord,
  ChannelSnapshot,
  Crop,
} from "../../../shared/document";
import {
  listCameras,
  startCamera,
  watchFrames,
  snapshotVideo,
  type Snapshot,
} from "../lib/camera";
import { ART_CORNERS, MAX_ANCHORS } from "../lib/calibration";
import { composeArtwork, type ComposeChannel } from "../lib/compose";
import type { Pt } from "../lib/transform";
import { decodeImage } from "../../source/lib/decode";
import { generate } from "../../mapping";
import { drawGrid } from "../../preview";
import { textContent } from "../../export/lib/text";
import { download, exportName } from "../../export/lib/download";

export type ChannelId = "left" | "right";
export type ChannelStatus = "idle" | "starting" | "live" | "error";

export interface ChannelState {
  id: ChannelId;
  state: ChannelStatus;
  deviceId: string;
  label: string;
  error: string;
  lost: boolean;
  mirror: boolean;
  crop: Crop;
  anchors: CalibrationAnchor[];
  anchorMode: boolean;
  fps: number;
  lastFrameAt: number | null;
  width: number;
  height: number;
  epoch: number;
}
interface Runtime {
  stream: MediaStream | null;
  video: HTMLVideoElement | null;
  cancelWatch: (() => void) | null;
  sinks: Set<(s: Snapshot) => void>;
}
/** 触发瞬间冻结的校准依据（镜像/裁剪/锚点），与帧一同绑定进记录 */
export interface Calib {
  mirror: boolean;
  crop: Crop;
  anchors: CalibrationAnchor[];
}
interface Pair {
  left: Snapshot;
  right: Snapshot;
  delta: number;
}
interface Pending {
  id: number;
  pair: Pair;
  calib: Record<ChannelId, Calib>;
}

const FULL_CROP: Crop = { x: 0, y: 0, width: 1, height: 1 };
const MAX_RECORDS = 30;

function createChannel(id: ChannelId): ChannelState {
  return {
    id,
    state: "idle",
    deviceId: "",
    label: "",
    error: "",
    lost: false,
    mirror: false,
    crop: { ...FULL_CROP },
    anchors: [],
    anchorMode: false,
    fps: 0,
    lastFrameAt: null,
    width: 0,
    height: 0,
    epoch: 0,
  };
}
function channelTitle(id: ChannelId): string {
  return id === "left" ? "左路机位" : "右路机位";
}

function createCapture(studio: StudioContext) {
  const { doc, notice, invalidate } = studio;
  const channels = reactive<Record<ChannelId, ChannelState>>({
    left: createChannel("left"),
    right: createChannel("right"),
  });
  const runtime: Record<ChannelId, Runtime> = {
    left: { stream: null, video: null, cancelWatch: null, sinks: new Set() },
    right: { stream: null, video: null, cancelWatch: null, sinks: new Set() },
  };
  const devices = ref<MediaDeviceInfo[]>([]);
  const capturing = ref(false);
  const triggerMode = ref<"wait" | "instant">("wait");
  const composeMode = ref<"compare" | "stitch">("compare");
  const thresholdMs = ref(80);
  const windowMs = ref(600);
  const liveDelta = ref<number | null>(null);
  const pending = ref<Pending | null>(null);
  const gallery = ref<CaptureRecord[]>([]);
  const lastResult = ref<{ id: number; delta: number | null; synced: boolean } | null>(null);
  let seq = 0;
  let session = 0;

  // ---------- 机位生命周期 ----------

  function release(cid: ChannelId) {
    const rt = runtime[cid];
    const ch = channels[cid];
    ch.epoch++; // 使进行中的采集失效
    rt.cancelWatch?.();
    rt.cancelWatch = null;
    rt.stream?.getTracks().forEach((t) => t.stop());
    rt.stream = null;
    if (rt.video) rt.video.srcObject = null;
    ch.lastFrameAt = null;
    ch.fps = 0;
    ch.width = 0;
    ch.height = 0;
    updateLiveDelta();
  }

  function beginWatch(cid: ChannelId) {
    const rt = runtime[cid];
    const ch = channels[cid];
    rt.cancelWatch?.();
    if (!rt.video) return;
    const video = rt.video;
    rt.cancelWatch = watchFrames(video, (tick) => {
      if (ch.lastFrameAt != null) {
        const dt = tick.at - ch.lastFrameAt;
        if (dt > 0 && dt < 1000) {
          const f = 1000 / dt;
          ch.fps = ch.fps ? ch.fps * 0.8 + f * 0.2 : f;
        }
      }
      ch.lastFrameAt = tick.at;
      if (video.videoWidth && video.videoWidth !== ch.width) {
        ch.width = video.videoWidth;
        ch.height = video.videoHeight;
      }
      updateLiveDelta();
      if (rt.sinks.size) {
        const snap = snapshotVideo(video, tick.at);
        if (snap) rt.sinks.forEach((fn) => fn(snap));
      }
    });
  }

  async function start(cid: ChannelId, deviceId?: string) {
    const ch = channels[cid];
    release(cid); // 切换设备/重连前释放旧采样任务
    ch.state = "starting";
    ch.error = "";
    ch.lost = false;
    try {
      const handle = await startCamera(deviceId ?? (ch.deviceId || undefined));
      if (ch.state !== "starting") {
        handle.stream.getTracks().forEach((t) => t.stop());
        return;
      }
      runtime[cid].stream = handle.stream;
      ch.deviceId = handle.deviceId;
      ch.label = handle.label;
      const track = handle.stream.getVideoTracks()[0]!;
      track.addEventListener("ended", () => {
        if (runtime[cid].stream !== handle.stream) return; // 过期轨道
        release(cid);
        ch.state = "idle";
        ch.lost = true;
        notice.value = `${channelTitle(cid)}「${ch.label}」已断开，对应采样任务已释放`;
      });
      if (runtime[cid].video) {
        runtime[cid].video.srcObject = handle.stream;
        runtime[cid].video.play().catch(() => {});
      }
      ch.state = "live";
      beginWatch(cid);
      void refreshDevices();
    } catch (e) {
      ch.state = "error";
      ch.error = e instanceof Error ? e.message : "无法打开摄像头";
      notice.value = `${channelTitle(cid)}：${ch.error}`;
    }
  }

  function stop(cid: ChannelId) {
    if (channels[cid].state === "idle") return;
    release(cid);
    channels[cid].state = "idle";
  }

  function attachVideo(cid: ChannelId, el: HTMLVideoElement | null) {
    runtime[cid].video = el;
    if (el && runtime[cid].stream) {
      el.srcObject = runtime[cid].stream;
      el.play().catch(() => {});
    }
  }

  async function refreshDevices() {
    devices.value = await listCameras();
  }

  async function onDeviceChange() {
    await refreshDevices();
    for (const cid of ["left", "right"] as const) {
      const ch = channels[cid];
      if (
        ch.state === "live" &&
        ch.deviceId &&
        !devices.value.some((d) => d.deviceId === ch.deviceId)
      ) {
        release(cid);
        ch.state = "idle";
        ch.lost = true;
        notice.value = `${channelTitle(cid)}设备已移除，对应采样任务已释放`;
      }
    }
  }

  function attach() {
    void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
  }

  function shutdown() {
    session++; // 进行中的采集全部失效
    navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
    for (const cid of ["left", "right"] as const) {
      release(cid);
      channels[cid].state = "idle";
    }
    capturing.value = false;
    pending.value = null;
    // 已确认的作品（gallery / doc.capture）保留
  }

  // ---------- 校准与预览偏好 ----------

  function toggleMirror(cid: ChannelId) {
    channels[cid].mirror = !channels[cid].mirror;
  }
  function setCrop(cid: ChannelId, crop: Crop) {
    channels[cid].crop = crop;
  }
  function resetCrop(cid: ChannelId) {
    channels[cid].crop = { ...FULL_CROP };
  }
  function toggleAnchorMode(cid: ChannelId) {
    const ch = channels[cid];
    ch.anchorMode = !ch.anchorMode;
  }
  function addAnchor(cid: ChannelId, framePt: Pt) {
    const ch = channels[cid];
    if (ch.anchors.length >= MAX_ANCHORS) return;
    const art = ART_CORNERS[ch.anchors.length]!;
    ch.anchors.push({ frame: { ...framePt }, art: { ...art } });
    if (ch.anchors.length >= MAX_ANCHORS) ch.anchorMode = false;
  }
  function clearAnchors(cid: ChannelId) {
    channels[cid].anchors = [];
  }

  function updateLiveDelta() {
    const l = channels.left.lastFrameAt,
      r = channels.right.lastFrameAt;
    liveDelta.value =
      channels.left.state === "live" && channels.right.state === "live" && l != null && r != null
        ? Math.abs(l - r)
        : null;
  }

  // ---------- 触发与同步 ----------

  function snapshotCalib(cid: ChannelId): Calib {
    const ch = channels[cid];
    return {
      mirror: ch.mirror,
      crop: { ...ch.crop },
      anchors: ch.anchors.map((a) => ({ frame: { ...a.frame }, art: { ...a.art } })),
    };
  }

  function snapshotNow(cid: ChannelId): Snapshot | null {
    const rt = runtime[cid];
    const ch = channels[cid];
    if (!rt.video || ch.lastFrameAt == null) return null;
    if (performance.now() - ch.lastFrameAt > 2000) return null; // 画面停滞，不拿旧帧充数
    return snapshotVideo(rt.video, ch.lastFrameAt);
  }

  function grabInstant(id: number, epochs: Record<ChannelId, number>): Pair | null {
    const left = snapshotNow("left");
    const right = snapshotNow("right");
    if (!left || !right) {
      notice.value = `采集 #${id} 未能获取画面，请重试`;
      return null;
    }
    if (channels.left.epoch !== epochs.left || channels.right.epoch !== epochs.right) {
      notice.value = `采集 #${id} 已中止：机位状态发生变化`;
      return null;
    }
    return { left, right, delta: Math.abs(left.at - right.at) };
  }

  /** 等候窗口内持续收集两路帧，选出时差最小的一对 */
  function grabWindow(id: number, epochs: Record<ChannelId, number>): Promise<Pair | null> {
    return new Promise((resolve) => {
      const sessionAt = session;
      const candL: Snapshot[] = [];
      const candR: Snapshot[] = [];
      const seedL = snapshotNow("left");
      const seedR = snapshotNow("right");
      if (seedL) candL.push(seedL);
      if (seedR) candR.push(seedR);
      const sinkL = (s: Snapshot) => candL.push(s);
      const sinkR = (s: Snapshot) => candR.push(s);
      runtime.left.sinks.add(sinkL);
      runtime.right.sinks.add(sinkR);
      const deadline = performance.now() + windowMs.value;
      const cleanup = () => {
        clearInterval(timer);
        runtime.left.sinks.delete(sinkL);
        runtime.right.sinks.delete(sinkR);
      };
      const valid = () =>
        session === sessionAt &&
        channels.left.epoch === epochs.left &&
        channels.right.epoch === epochs.right &&
        channels.left.state === "live" &&
        channels.right.state === "live";
      const timer = setInterval(() => {
        if (!valid()) {
          cleanup();
          notice.value = `采集 #${id} 已中止：机位状态发生变化`;
          resolve(null);
          return;
        }
        if (performance.now() < deadline) return;
        cleanup();
        let best: Pair | null = null;
        for (const left of candL)
          for (const right of candR) {
            const delta = Math.abs(left.at - right.at);
            if (!best || delta < best.delta) best = { left, right, delta };
          }
        if (!best) notice.value = `采集 #${id} 未能获取画面，请重试`;
        resolve(best);
      }, 25);
    });
  }

  function toComposeChannel(snap: Snapshot, calib: Calib): ComposeChannel {
    return { canvas: snap.canvas, mirror: calib.mirror, crop: calib.crop, anchors: calib.anchors };
  }
  function toChannelSnapshot(cid: ChannelId, snap: Snapshot, calib: Calib): ChannelSnapshot {
    return {
      label: channels[cid].label,
      mirror: calib.mirror,
      crop: { ...calib.crop },
      anchors: calib.anchors.map((a) => ({ frame: { ...a.frame }, art: { ...a.art } })),
      frameUrl: snap.canvas.toDataURL("image/jpeg", 0.9),
      width: snap.width,
      height: snap.height,
      capturedAt: snap.at,
    };
  }

  /** 定格：原始帧 + 校准变换 + 字符网格绑定为一条采集记录，并载入画布 */
  async function finalize(
    id: number,
    mode: CaptureRecord["mode"],
    inputs: { cid: ChannelId; snap: Snapshot; calib: Calib }[],
    deltaMs: number | null,
  ) {
    const left = inputs.find((i) => i.cid === "left") ?? null;
    const right = inputs.find((i) => i.cid === "right") ?? null;
    const composed = composeArtwork(
      mode,
      left ? toComposeChannel(left.snap, left.calib) : null,
      right ? toComposeChannel(right.snap, right.calib) : null,
      doc.settings.background,
    );
    const url = composed.toDataURL("image/jpeg", 0.92);
    const asset = await decodeImage(url, `采集 #${id}`);
    doc.asset = asset;
    doc.crop = { ...FULL_CROP };
    const grid = generate(doc);
    if (!grid) throw new Error("生成字符网格失败");
    const record: CaptureRecord = {
      id,
      createdAt: Date.now(),
      mode,
      left: left ? toChannelSnapshot("left", left.snap, left.calib) : null,
      right: right ? toChannelSnapshot("right", right.snap, right.calib) : null,
      deltaMs,
      synced: deltaMs != null,
      assetUrl: url,
      assetWidth: composed.width,
      assetHeight: composed.height,
      color: doc.settings.color,
      background: doc.settings.background,
      grid,
    };
    doc.capture = record;
    gallery.value = [record, ...gallery.value].slice(0, MAX_RECORDS);
    lastResult.value = { id, delta: deltaMs, synced: true };
    invalidate();
    notice.value =
      deltaMs == null
        ? `采集 #${id} 已定格（单路）`
        : `采集 #${id} 已同步定格，时差 ${Math.round(deltaMs)} ms`;
  }

  async function trigger() {
    if (capturing.value) return;
    const live = (["left", "right"] as const).filter(
      (cid) => channels[cid].state === "live" && runtime[cid].video,
    );
    if (!live.length) {
      notice.value = "请先接入至少一路摄像头";
      return;
    }
    pending.value = null;
    const id = ++seq;
    capturing.value = true;
    try {
      if (live.length === 2) {
        const calib: Record<ChannelId, Calib> = {
          left: snapshotCalib("left"),
          right: snapshotCalib("right"),
        };
        const epochs = { left: channels.left.epoch, right: channels.right.epoch };
        const pair =
          triggerMode.value === "wait"
            ? await grabWindow(id, epochs)
            : grabInstant(id, epochs);
        if (!pair) return;
        if (pair.delta <= thresholdMs.value) {
          await finalize(id, composeMode.value, [
            { cid: "left", snap: pair.left, calib: calib.left },
            { cid: "right", snap: pair.right, calib: calib.right },
          ], pair.delta);
        } else {
          // 不假装同步成功：保留证据，交给用户选择
          pending.value = { id, pair, calib };
          lastResult.value = { id, delta: pair.delta, synced: false };
          notice.value = `采集 #${id} 时差 ${Math.round(pair.delta)} ms，超出 ${thresholdMs.value} ms 阈值`;
        }
      } else {
        const cid = live[0]!;
        const calib = snapshotCalib(cid);
        const snap = snapshotNow(cid);
        if (!snap) {
          notice.value = "未能获取画面，请稍后重试";
          return;
        }
        await finalize(id, "single", [{ cid, snap, calib }], null);
      }
    } catch (e) {
      notice.value = e instanceof Error ? e.message : `采集 #${id} 失败`;
    } finally {
      capturing.value = false;
    }
  }

  function retry() {
    pending.value = null;
    void trigger();
  }

  /** 明确采用单路：与同一次触发共用采集编号 */
  async function adoptSingle(cid: ChannelId) {
    const p = pending.value;
    if (!p) return;
    pending.value = null;
    const snap = cid === "left" ? p.pair.left : p.pair.right;
    try {
      await finalize(p.id, "single", [{ cid, snap, calib: p.calib[cid] }], null);
    } catch (e) {
      notice.value = e instanceof Error ? e.message : `采集 #${p.id} 失败`;
    }
  }

  // ---------- 作品画廊 ----------

  async function loadRecord(rec: CaptureRecord) {
    try {
      const asset = await decodeImage(rec.assetUrl, `采集 #${rec.id}`);
      doc.asset = asset;
      doc.crop = { ...FULL_CROP };
      doc.capture = rec;
      invalidate();
      notice.value = `采集 #${rec.id} 已载入画布`;
    } catch {
      notice.value = "无法载入该采集记录";
    }
  }
  function exportRecordPng(rec: CaptureRecord) {
    const c = document.createElement("canvas");
    drawGrid(c, rec.grid, rec.color, rec.background);
    c.toBlob((b) => {
      if (b) download(b, exportName(`采集-${rec.id}`, "png"));
    }, "image/png");
    notice.value = `采集 #${rec.id} PNG 已导出`;
  }
  function exportRecordTxt(rec: CaptureRecord) {
    download(
      new Blob([textContent(rec.grid)], { type: "text/plain;charset=utf-8" }),
      exportName(`采集-${rec.id}`, "txt"),
    );
    notice.value = `采集 #${rec.id} 文本已导出`;
  }
  function removeRecord(rec: CaptureRecord) {
    gallery.value = gallery.value.filter((r) => r.id !== rec.id);
    if (doc.capture?.id === rec.id) doc.capture = null;
  }

  return {
    channels,
    devices,
    capturing,
    triggerMode,
    composeMode,
    thresholdMs,
    windowMs,
    liveDelta,
    pending,
    gallery,
    lastResult,
    attach,
    shutdown,
    attachVideo,
    start,
    stop,
    toggleMirror,
    setCrop,
    resetCrop,
    toggleAnchorMode,
    addAnchor,
    clearAnchors,
    trigger,
    retry,
    adoptSingle,
    loadRecord,
    exportRecordPng,
    exportRecordTxt,
    removeRecord,
    channelTitle,
  };
}

let instance: ReturnType<typeof createCapture> | null = null;
/** 单例：画廊与采集编号在采集台开关之间保留 */
export function useCapture() {
  const studio = useStudio();
  if (!instance) instance = createCapture(studio);
  return instance;
}
