<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import {
  AlertTriangle,
  CheckCircle2,
  Columns2,
  Merge,
  Timer,
  X,
  Zap,
} from "lucide-vue-next";
import { useCapture } from "../model/useCapture";
import ChannelView from "./ChannelView.vue";
import CaptureGallery from "./CaptureGallery.vue";

const emit = defineEmits<{ close: [] }>();
const c = useCapture();
onMounted(() => c.attach());
onBeforeUnmount(() => c.shutdown());

const bothLive = computed(
  () => c.channels.left.state === "live" && c.channels.right.state === "live",
);
const liveDeltaLabel = computed(() => {
  if (c.liveDelta.value == null) return "—";
  return `≈ ${Math.round(c.liveDelta.value)} ms`;
});
const pendingDelta = computed(() =>
  c.pending.value ? Math.round(c.pending.value.pair.delta) : 0,
);
</script>

<template>
  <div class="station-overlay" @click.self="emit('close')">
    <div class="station" role="dialog" aria-label="多机位字符采集台">
      <header class="station-head">
        <div>
          <div class="eyebrow"><span /> MULTI-CAM CAPTURE</div>
          <h3>多机位字符采集台</h3>
        </div>
        <button class="icon-button" aria-label="关闭采集台" @click="emit('close')">
          <X :size="16" />
        </button>
      </header>

      <div class="station-controls">
        <div class="control-group">
          <span class="control-label">构图</span>
          <button
            class="chip"
            :class="{ on: c.composeMode.value === 'compare' }"
            @click="c.composeMode.value = 'compare'"
          >
            <Columns2 :size="13" />左右对照
          </button>
          <button
            class="chip"
            :class="{ on: c.composeMode.value === 'stitch' }"
            @click="c.composeMode.value = 'stitch'"
          >
            <Merge :size="13" />无缝拼接
          </button>
        </div>
        <div class="control-group">
          <span class="control-label">触发</span>
          <button
            class="chip"
            :class="{ on: c.triggerMode.value === 'wait' }"
            @click="c.triggerMode.value = 'wait'"
          >
            <Timer :size="13" />等候更接近的帧
          </button>
          <button
            class="chip"
            :class="{ on: c.triggerMode.value === 'instant' }"
            @click="c.triggerMode.value = 'instant'"
          >
            <Zap :size="13" />立即保留瞬间
          </button>
        </div>
        <label class="control-group inline">
          <span class="control-label">可接受时差</span>
          <input
            type="range"
            min="20"
            max="500"
            step="10"
            v-model.number="c.thresholdMs.value"
          />
          <b class="mono">{{ c.thresholdMs.value }} ms</b>
        </label>
        <label v-if="c.triggerMode.value === 'wait'" class="control-group inline">
          <span class="control-label">等候窗口</span>
          <input
            type="range"
            min="200"
            max="1500"
            step="50"
            v-model.number="c.windowMs.value"
          />
          <b class="mono">{{ c.windowMs.value }} ms</b>
        </label>
        <div class="control-group trigger-group">
          <span class="delta-chip mono" :class="{ ok: bothLive }">
            当前时差 {{ liveDeltaLabel }}
          </span>
          <button
            class="primary trigger-btn"
            :disabled="c.capturing.value"
            @click="c.trigger"
          >
            {{ c.capturing.value ? "采集中…" : "触发采集" }}
          </button>
        </div>
      </div>

      <div class="station-channels">
        <ChannelView id="left" />
        <ChannelView id="right" />
      </div>

      <div v-if="c.pending.value" class="sync-banner warn" role="alert">
        <AlertTriangle :size="15" />
        <span>
          采集 #{{ c.pending.value.id }} 两路时差 {{ pendingDelta }} ms，超出可接受
          {{ c.thresholdMs.value }} ms —— 未按同步成功处理。
        </span>
        <div class="sync-actions">
          <button class="chip" @click="c.retry">重试</button>
          <button class="chip" @click="c.adoptSingle('left')">采用左路</button>
          <button class="chip" @click="c.adoptSingle('right')">采用右路</button>
        </div>
      </div>
      <div
        v-else-if="c.lastResult.value"
        class="sync-banner ok"
        role="status"
      >
        <CheckCircle2 :size="15" />
        <span v-if="c.lastResult.value.delta == null">
          采集 #{{ c.lastResult.value.id }} 已定格（单路），作品见下方画廊。
        </span>
        <span v-else>
          采集 #{{ c.lastResult.value.id }} 同步成功，时差
          {{ Math.round(c.lastResult.value.delta) }} ms，作品见下方画廊。
        </span>
      </div>

      <CaptureGallery />
    </div>
  </div>
</template>
