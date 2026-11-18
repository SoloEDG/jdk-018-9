<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import type { Grid } from "../../../shared/document";
import { drawGrid } from "../lib/draw";
const props = defineProps<{
  grid: Grid;
  color: boolean;
  background: string;
  zoom: number;
}>();
const canvas = ref<HTMLCanvasElement>();
function draw() {
  if (canvas.value)
    drawGrid(canvas.value, props.grid, props.color, props.background);
}
onMounted(draw);
watch(() => [props.grid, props.color, props.background], draw);
</script>
<template>
  <canvas
    ref="canvas"
    aria-label="字符画预览"
    :style="{
      width: (grid.columns * 8 * zoom) / 100 + 'px',
      height: (grid.rows * 16 * zoom) / 100 + 'px',
    }"
  />
</template>
