<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import type { Photo } from '../types';

defineProps<{
  photo: Photo;
  /** 是否处于选择模式（显示勾选框） */
  selectable?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{ (e: 'toggle-select'): void }>();

function aspectClass(p: Photo): string {
  return p.width >= p.height ? 'aspect-landscape' : 'aspect-portrait';
}
</script>

<template>
  <article class="photo-card" :class="[aspectClass(photo), { selected }]" :title="photo.name">
    <img :src="photo.src" :alt="photo.name" loading="lazy" decoding="async" />
    <button
      v-if="selectable"
      class="select-badge"
      :class="{ checked: selected }"
      type="button"
      :aria-label="selected ? '取消选择' : '选择'"
      @click.stop="emit('toggle-select')"
    >
      <Check v-if="selected" :size="12" stroke-width="3.5" />
    </button>
    <div class="photo-overlay">
      <span class="overlay-name">{{ photo.name }}</span>
      <span v-if="photo.isFavorite" class="overlay-fav">♥</span>
    </div>
  </article>
</template>

<style scoped>
.photo-card {
  position: relative;
  cursor: pointer;
  border-radius: calc(var(--radius) - 4px);
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--secondary);
  transition: border-color 0.2s ease;
}
.photo-card:hover {
  border-color: var(--primary);
}
.photo-card.selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 45%, transparent);
}
.photo-card img {
  width: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}
.photo-card.aspect-portrait img {
  aspect-ratio: 3 / 4;
}
.photo-card.aspect-landscape img {
  aspect-ratio: 4 / 3;
}
.photo-card:hover img {
  transform: scale(1.02);
}
.photo-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: var(--photo-overlay);
  color: var(--background-50);
  font-size: 11px;
}
.overlay-fav {
  color: var(--tl-red);
  font-size: 12px;
}

/* 选择勾选框 */
.select-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid var(--background-50);
  background: rgba(0, 0, 0, 0.35);
  color: var(--background-50);
  cursor: pointer;
  backdrop-filter: blur(2px);
  transition: background-color 0.18s ease, border-color 0.18s ease;
  padding: 0;
}
.select-badge:hover {
  background: rgba(0, 0, 0, 0.55);
}
.select-badge.checked {
  background: var(--primary);
  border-color: var(--primary);
}

@media (prefers-reduced-motion: reduce) {
  .photo-card:hover img {
    transform: none;
  }
}
</style>
