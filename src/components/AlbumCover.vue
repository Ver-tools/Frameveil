<script setup lang="ts">
import { Image } from 'lucide-vue-next';

defineProps<{
  src?: string;
  alt?: string;
  /** 图标尺寸 */
  iconSize?: number;
}>();
</script>

<template>
  <img v-if="src" :src="src" :alt="alt || ''" loading="lazy" decoding="async" class="ac-img" />
  <div v-else class="ac-placeholder" role="img" :aria-label="alt || '无封面'">
    <Image :size="iconSize || 28" class="ac-icon" />
  </div>
</template>

<style scoped>
.ac-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.ac-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--secondary), var(--accent));
  color: var(--muted-foreground);
}
</style>
