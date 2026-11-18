<script setup lang="ts">
import { SlidersHorizontal } from "lucide-vue-next";
import { useStudio } from "../../../shared/useStudio";
import { charsets } from "../lib/charsets";
const { doc, invalidate } = useStudio();
</script>
<template>
  <section class="panel">
    <div class="section-title">
      <span>03 / CHARACTER LAB</span><SlidersHorizontal :size="15" />
    </div>
    <label class="field"
      >字符密度 <b>{{ doc.settings.columns }} 列</b
      ><input
        aria-label="字符密度"
        type="range"
        min="30"
        max="220"
        step="1"
        v-model.number="doc.settings.columns"
        @input="invalidate"
    /></label>
    <div class="range-ends"><span>疏朗</span><span>精细</span></div>
    <label class="field"
      >字符集<select
        aria-label="字符集"
        v-model="doc.settings.charset"
        @change="invalidate"
      >
        <option v-for="c in charsets" :key="c.id" :value="c.id">
          {{ c.name }}
        </option>
        <option value="custom">自定义字符集</option>
      </select></label
    ><input
      v-if="doc.settings.charset === 'custom'"
      aria-label="自定义字符"
      class="custom"
      maxlength="100"
      v-model="doc.settings.custom"
      @input="invalidate"
    />
    <div class="glyph-strip">
      {{
        doc.settings.charset === "custom"
          ? doc.settings.custom
          : charsets.find((c) => c.id === doc.settings.charset)?.value
      }}
    </div>
    <label class="field"
      >对比度 <b>{{ doc.settings.contrast.toFixed(2) }}</b><input
        aria-label="对比度"
        type="range"
        min="0.3"
        max="2.5"
        step="0.05"
        v-model.number="doc.settings.contrast"
        @input="invalidate" /></label
    ><label class="field"
      >伽马 <b>{{ doc.settings.gamma.toFixed(2) }}</b><input
        aria-label="伽马"
        type="range"
        min="0.3"
        max="2.5"
        step="0.05"
        v-model.number="doc.settings.gamma"
        @input="invalidate" /></label
    ><label class="toggle-row"
      ><span>反转明暗</span
      ><input
        aria-label="反转明暗"
        type="checkbox"
        v-model="doc.settings.invert"
        @change="invalidate"
    /></label>
  </section>
</template>
