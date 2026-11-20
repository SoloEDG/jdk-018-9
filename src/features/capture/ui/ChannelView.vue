<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  Camera,
  CameraOff,
  Crosshair,
  FlipHorizontal2,
  RotateCcw,
  Trash2,
} from "lucide-vue-next";
import type { Crop } from "../../../shared/document";
import { normalizeCrop, cropFromPoints } from "../../crop/lib/geometry";
import {
  ART_CORNER_NAMES,
  MAX_ANCHORS,
  frameCropToScreen,
  frameToScreen,
  screenCropToFrame,
  screenToFrame,
} from "../lib/calibration";
import { useCapture, type ChannelId } from "../model/useCapture";

const props = defineProps<{ id: ChannelId }>();
const c = useCapture();
const ch = computed(() => c.channels[props.id]);

const videoEl = ref<HTMLVideoElement>();
onMounted(() => c.attachVideo(props.id, videoEl.value ?? null));
onBeforeUnmount(() => c.attachVideo(props.id, null));

const title = computed(() => c.channelTitle(props.id));
const stateLabel = computed(() => {
  const s = ch.value.state;
  if (s === "live") return "采集中";
  if (s === "starting") return "请求权限…";
  if (s === "error") return "错误";
  return ch.value.lost ? "已断开" : "未接入";
});
const stageRatio = computed(() =>
  ch.value.width && ch.value.height ? `${ch.value.width} / ${ch.value.height}` : "4 / 3",
);

// ---------- 裁剪（屏幕坐标交互 → 原始帧坐标存储） ----------
const draft = ref<Crop | null>(null);
const dragStart = ref<{ x: number; y: number } | null>(null);
const stageEl = ref<HTMLElement>();

function point(e: PointerEvent) {
  const b = stageEl.value!.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
    y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)),
  };
}
function down(e: PointerEvent) {
  if (ch.value.state !== "live") return;
  const p = point(e);
  if (ch.value.anchorMode) {
    // 锚点同样以原始帧坐标存储，屏幕镜像只影响落点换算
    c.addAnchor(props.id, screenToFrame(p, ch.value.mirror));
    return;
  }
  dragStart.value = p;
  stageEl.value?.setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  if (!dragStart.value) return;
  const p = point(e);
  draft.value = cropFromPoints(dragStart.value.x, dragStart.value.y, p.x, p.y);
}
function up(e: PointerEvent) {
  if (!dragStart.value) return;
  move(e);
  if (draft.value) {
    c.setCrop(
      props.id,
      normalizeCrop(screenCropToFrame(draft.value, ch.value.mirror)),
    );
  }
  draft.value = null;
  dragStart.value = null;
}
const shownCrop = computed(() => {
  const crop = draft.value ?? frameCropToScreen(ch.value.crop, ch.value.mirror);
  return crop;
});
const cropStyle = computed(() => ({
  left: shownCrop.value.x * 100 + "%",
  top: shownCrop.value.y * 100 + "%",
  width: shownCrop.value.width * 100 + "%",
  height: shownCrop.value.height * 100 + "%",
}));
const anchorsView = computed(() =>
  ch.value.anchors.map((a, i) => {
    const p = frameToScreen(a.frame, ch.value.mirror);
    return {
      i,
      left: p.x * 100 + "%",
      top: p.y * 100 + "%",
      corner: ART_CORNER_NAMES[i] ?? "",
    };
  }),
);
const anchorHint = computed(() => {
  const n = ch.value.anchors.length;
  if (!ch.value.anchorMode) return "";
  return n >= MAX_ANCHORS
    ? "锚点已完成"
    : `点击画面放置锚点 ${n + 1} → 作品${ART_CORNER_NAMES[n]}`;
});
const calibLabel = computed(() =>
  ch.value.anchors.length >= 2
    ? `锚点校准生效 ${ch.value.anchors.length}/${MAX_ANCHORS}（采样忽略裁剪框）`
    : ch.value.anchors.length === 1
      ? "还需至少 2 个锚点才生效"
      : "裁剪框采样",
);

function switchDevice(e: Event) {
  const deviceId = (e.target as HTMLSelectElement).value;
  void c.start(props.id, deviceId || undefined);
}
function toggleRunning() {
  if (ch.value.state === "live" || ch.value.state === "starting") c.stop(props.id);
  else void c.start(props.id);
}
</script>

<template>
  <div class="channel" :data-state="ch.state">
    <div class="channel-head">
      <span class="channel-name">{{ title }}</span>
      <span class="channel-badge" :data-state="ch.state" :data-lost="ch.lost">
        {{ stateLabel }}
      </span>
    </div>
    <div
      ref="stageEl"
      class="channel-stage"
      :class="{ anchoring: ch.anchorMode }"
      :style="{ aspectRatio: stageRatio }"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="draft = null; dragStart = null"
    >
      <video
        ref="videoEl"
        autoplay
        playsinline
        muted
        :class="{ mirrored: ch.mirror }"
      ></video>
      <template v-if="ch.state === 'live'">
        <div class="cam-crop" :style="cropStyle"><i /><i /><i /><i /></div>
        <span
          v-for="a in anchorsView"
          :key="a.i"
          class="cam-anchor"
          :style="{ left: a.left, top: a.top }"
          >{{ a.i + 1 }}<small>{{ a.corner }}</small></span
        >
      </template>
      <div v-else class="channel-empty">
        <CameraOff :size="22" />
        <span>{{ ch.state === "error" ? ch.error : stateLabel }}</span>
      </div>
    </div>
    <div class="channel-controls">
      <select
        aria-label="选择摄像头"
        :value="ch.deviceId"
        :disabled="ch.state === 'starting'"
        @change="switchDevice"
      >
        <option value="">默认摄像头</option>
        <option v-for="d in c.devices.value" :key="d.deviceId" :value="d.deviceId">
          {{ d.label || "摄像头 " + d.deviceId.slice(0, 6) }}
        </option>
      </select>
      <button class="chip" :class="{ on: ch.state === 'live' }" @click="toggleRunning">
        <Camera :size="13" />{{ ch.state === "live" ? "停止" : "接入" }}
      </button>
    </div>
    <div class="channel-controls">
      <button
        class="chip"
        :class="{ on: ch.mirror }"
        :aria-pressed="ch.mirror"
        @click="c.toggleMirror(props.id)"
      >
        <FlipHorizontal2 :size="13" />镜像
      </button>
      <button
        class="chip"
        :class="{ on: ch.anchorMode }"
        :disabled="ch.state !== 'live'"
        @click="c.toggleAnchorMode(props.id)"
      >
        <Crosshair :size="13" />锚点
      </button>
      <button
        class="chip"
        :disabled="!ch.anchors.length"
        aria-label="清除锚点"
        @click="c.clearAnchors(props.id)"
      >
        <Trash2 :size="13" />清锚点
      </button>
      <button class="chip" aria-label="重置裁剪" @click="c.resetCrop(props.id)">
        <RotateCcw :size="13" />重置
      </button>
    </div>
    <div class="channel-meta mono">
      <span v-if="ch.state === 'live'">
        {{ ch.width }}×{{ ch.height }} · {{ Math.round(ch.fps) }} fps
      </span>
      <span v-else class="muted">—</span>
      <span class="muted">{{ anchorHint || calibLabel }}</span>
    </div>
  </div>
</template>
