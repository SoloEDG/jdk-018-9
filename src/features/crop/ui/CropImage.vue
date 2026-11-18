<script setup lang="ts">
import type { Asset, Crop } from "../../../shared/document";
defineProps<{ asset: Asset; crop: Crop }>();
</script>
<template>
  <div class="crop-image">
    <img :src="asset.url" :alt="asset.name" draggable="false" />
    <div
      class="crop-box"
      :style="{
        left: crop.x * 100 + '%',
        top: crop.y * 100 + '%',
        width: crop.width * 100 + '%',
        height: crop.height * 100 + '%',
      }"
    >
      <i /><i /><i /><i />
    </div>
  </div>
</template>
