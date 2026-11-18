<script setup lang="ts">
import { computed } from "vue";
import { Crop, RotateCcw } from "lucide-vue-next";
import { useCrop } from "../model/useCrop";
import CropImage from "./CropImage.vue";
const c = useCrop();
const selection = computed(() => (c.start.value ? c.draft.value : c.doc.crop));
</script>
<template>
  <section class="panel">
    <div class="section-title"><span>02 / CROP</span><Crop :size="15" /></div>
    <div
      v-if="c.doc.asset"
      class="crop-interaction"
      @pointerdown="c.down"
      @pointermove="c.move"
      @pointerup="c.up"
      @pointercancel="c.start.value = null"
    >
      <CropImage :asset="c.doc.asset" :crop="selection" />
    </div>
    <div class="row hint">
      <span>拖动框选转换区域</span
      ><button class="icon-button" aria-label="重置裁剪" @click="c.reset">
        <RotateCcw :size="13" />
      </button>
    </div>
    <small class="mono muted"
      >{{ Math.round(selection.width * 100) }}% W ×
      {{ Math.round(selection.height * 100) }}% H</small
    >
  </section>
</template>
