<script setup lang="ts">
import { useThumbSrc } from '../utils/thumbs';

const props = defineProps<{
  /** 磁盘路径（内置照片传 undefined，直接用 fallback） */
  path?: string;
  /** 缩略图不可用时的回退地址 */
  fallback: string;
  alt?: string;
  /** 缩略图最长边（默认 480；同尺寸共享缓存） */
  maxDim?: number;
}>();

const src = useThumbSrc(props.path, props.fallback, props.maxDim ?? 480);
</script>

<template>
  <img :src="src" :alt="alt || ''" loading="lazy" decoding="async" />
</template>
