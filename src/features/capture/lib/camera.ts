export interface CameraHandle {
  stream: MediaStream;
  deviceId: string;
  label: string;
}
export interface FrameTick {
  /** 与 performance.now() 同一时钟的帧时间（ms），用于跨机位时差计算 */
  at: number;
}
export interface Snapshot {
  canvas: HTMLCanvasElement;
  at: number;
  width: number;
  height: number;
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    cb: (now: number, metadata?: { captureTime?: number; mediaTime?: number }) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === "videoinput");
  } catch {
    return [];
  }
}

async function getStream(
  constraints: MediaTrackConstraints | boolean,
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
}

/** 打开摄像头；指定设备失效时回退到默认设备 */
export async function startCamera(deviceId?: string): Promise<CameraHandle> {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error("此浏览器不支持摄像头采集");
  let stream: MediaStream;
  try {
    stream = await getStream(deviceId ? { deviceId: { exact: deviceId } } : true);
  } catch (e) {
    if (
      deviceId &&
      e instanceof DOMException &&
      (e.name === "OverconstrainedError" || e.name === "NotFoundError")
    ) {
      stream = await getStream(true);
    } else if (e instanceof DOMException && e.name === "NotAllowedError") {
      throw new Error("摄像头权限被拒绝，请在浏览器中允许后重试");
    } else {
      throw new Error("无法打开摄像头，请检查设备连接");
    }
  }
  const track = stream.getVideoTracks()[0];
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("未获取到视频轨道");
  }
  const settings = track.getSettings();
  return {
    stream,
    deviceId: settings.deviceId ?? deviceId ?? "",
    label: track.label || "摄像头",
  };
}

/**
 * 监听视频帧。优先 requestVideoFrameCallback（带采集时间戳），
 * 否则退化为定时采样。返回取消函数，释放该路的采样任务。
 */
export function watchFrames(
  video: HTMLVideoElement,
  cb: (tick: FrameTick) => void,
): () => void {
  const v = video as VideoWithFrameCallback;
  let stopped = false;
  if (typeof v.requestVideoFrameCallback === "function") {
    let handle = 0;
    const loop = (now: number, metadata?: { captureTime?: number }) => {
      if (stopped) return;
      cb({
        at:
          typeof metadata?.captureTime === "number"
            ? metadata.captureTime
            : now,
      });
      handle = v.requestVideoFrameCallback!(loop);
    };
    handle = v.requestVideoFrameCallback(loop);
    return () => {
      stopped = true;
      v.cancelVideoFrameCallback?.(handle);
    };
  }
  const timer = setInterval(() => {
    if (!stopped) cb({ at: performance.now() });
  }, 1000 / 15);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/** 定格当前原始帧（不含镜像/裁剪等屏幕变换），限制最长边以控制内存 */
export function snapshotVideo(
  video: HTMLVideoElement,
  at: number,
  maxWidth = 1280,
): Snapshot | null {
  const w = video.videoWidth,
    h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, maxWidth / w);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(w * scale));
  canvas.height = Math.max(2, Math.round(h * scale));
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(video, 0, 0, canvas.width, canvas.height);
  return { canvas, at, width: canvas.width, height: canvas.height };
}
