<script setup lang="ts">
import { Asterisk, LockKeyhole, ArrowUpRight } from "lucide-vue-next";
import { useWorkspace } from "./useWorkspace";
import { SourcePanel } from "../features/source";
import { CropPanel } from "../features/crop";
import { MappingPanel } from "../features/mapping";
import { PreviewPanel } from "../features/preview";
import { ExportPanel } from "../features/export";
const w = useWorkspace();
</script>
<template>
  <div class="app">
    <header>
      <a class="brand" href="./"
        ><span class="brand-mark"><Asterisk :size="27" /></span> GLYPH<span
          class="brand-sub"
          >/ ASCII STUDIO</span
        ></a
      >
      <div class="header-right">
        <span><LockKeyhole :size="12" /> 本地处理 · 无需上传</span
        ><span class="version">V.1.0 <ArrowUpRight :size="12" /></span>
      </div>
    </header>
    <div class="intro">
      <div>
        <div class="eyebrow"><span /> THE ART OF LESS</div>
        <h1>让图像，用字符说话<span>。</span></h1>
        <p>把细腻光影，转译成有温度的 ASCII 艺术。</p>
      </div>
      <div class="intro-code">
        . : - = + * # % @<small>PIXELS → CHARACTERS → ART</small>
      </div>
    </div>
    <div class="editor">
      <aside><SourcePanel /><CropPanel /><MappingPanel /></aside>
      <div class="result"><PreviewPanel /><ExportPanel /></div>
    </div>
    <footer>
      <span role="status">{{ w.notice.value }}</span
      ><span>CRAFTED IN CHARACTERS <b>✳</b></span>
    </footer>
  </div>
</template>
