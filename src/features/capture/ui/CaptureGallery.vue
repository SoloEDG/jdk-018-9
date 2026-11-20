<script setup lang="ts">
import { Download, FileText, Images, Trash2, Upload } from "lucide-vue-next";
import type { CaptureRecord } from "../../../shared/document";
import { useCapture } from "../model/useCapture";

const c = useCapture();
const modeLabel = (m: CaptureRecord["mode"]) =>
  m === "compare" ? "左右对照" : m === "stitch" ? "拼接" : "单路";
const time = (t: number) =>
  new Date(t).toLocaleTimeString("zh-CN", { hour12: false });
</script>

<template>
  <section v-if="c.gallery.value.length" class="gallery">
    <div class="gallery-head">
      <span><Images :size="13" /> 已确认作品 · {{ c.gallery.value.length }}</span>
      <small>原始帧 + 校准变换 + 字符网格绑定保存，机位断开后依然保留</small>
    </div>
    <div class="gallery-strip">
      <article v-for="rec in c.gallery.value" :key="rec.id" class="gallery-card">
        <div class="gallery-thumb">
          <img :src="rec.assetUrl" :alt="`采集 #${rec.id}`" draggable="false" />
          <span class="gallery-id mono">#{{ rec.id }}</span>
        </div>
        <div class="gallery-meta">
          <span>{{ modeLabel(rec.mode) }}</span>
          <span class="mono muted">
            {{ rec.deltaMs == null ? "单路" : `Δ ${Math.round(rec.deltaMs)} ms` }}
          </span>
          <span class="muted">{{ time(rec.createdAt) }}</span>
        </div>
        <div class="gallery-actions">
          <button class="chip" @click="c.loadRecord(rec)">
            <Upload :size="12" />载入
          </button>
          <button class="chip" aria-label="导出 PNG" @click="c.exportRecordPng(rec)">
            <Download :size="12" />PNG
          </button>
          <button class="chip" aria-label="导出文本" @click="c.exportRecordTxt(rec)">
            <FileText :size="12" />TXT
          </button>
          <button
            class="chip danger"
            aria-label="删除记录"
            @click="c.removeRecord(rec)"
          >
            <Trash2 :size="12" />
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
