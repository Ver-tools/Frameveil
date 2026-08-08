<script setup lang="ts">
import type { Photo } from '../types';

defineProps<{ photo: Photo }>();

function aspectClass(p: Photo): string {
  return p.width >= p.height ? 'aspect-landscape' : 'aspect-portrait';
}
</script>

<template>
  <article class="photo-card" :class="aspectClass(photo)" :title="photo.name">
    <img :src="photo.src" :alt="photo.name" loading="lazy" />
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

@media (prefers-reduced-motion: reduce) {
  .photo-card:hover img {
    transform: none;
  }
}
</style>
