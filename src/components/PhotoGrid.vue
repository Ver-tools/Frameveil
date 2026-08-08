<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Check } from 'lucide-vue-next';
import type { Photo } from '../types';
import PhotoCard from './PhotoCard.vue';
import { openViewer, selection, toggleSelect } from '../store/library';
import { formatBytes, formatTimestamp } from '../utils/format';

const props = defineProps<{
  photos: Photo[];
  /** grid 网格 / list 列表 */
  view: 'grid' | 'list';
  /** 当前来源页面标题与路由（用于查看器返回） */
  context?: { label: string; route: string };
  albumId?: string;
}>();

const router = useRouter();

function open(photo: Photo, index: number) {
  openViewer(props.photos, index, props.albumId, props.context);
  router.push({ path: `/viewer/${photo.id}` });
}

/** 选择模式下点击切换选择，否则打开查看器 */
function onCardClick(photo: Photo, index: number) {
  if (selection.active) toggleSelect(photo.id);
  else open(photo, index);
}
</script>

<template>
  <div v-if="view === 'grid'" class="photo-grid">
    <div v-for="(p, i) in photos" :key="p.id" class="grid-cell" @click="onCardClick(p, i)">
      <PhotoCard
        :photo="p"
        :selectable="selection.active"
        :selected="selection.active && selection.ids.has(p.id)"
        @toggle-select="toggleSelect(p.id)"
      />
    </div>
  </div>

  <div v-else class="photo-list">
    <div v-for="(p, i) in photos" :key="p.id" class="list-row" @click="onCardClick(p, i)">
      <span v-if="selection.active" class="list-check" :class="{ checked: selection.ids.has(p.id) }">
        <Check v-if="selection.ids.has(p.id)" :size="12" stroke-width="3.5" />
      </span>
      <img class="list-thumb" :src="p.src" :alt="p.name" loading="lazy" decoding="async" />
      <div class="list-main">
        <span class="list-name">{{ p.name }}</span>
        <span class="list-meta">{{ formatTimestamp(p.importedAt) }} · {{ p.format }}</span>
      </div>
      <span v-if="p.isFavorite" class="list-fav">♥</span>
      <span class="list-size">{{ formatBytes(p.size) }}</span>
    </div>
  </div>
</template>

<style scoped>
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 16px;
}
.grid-cell {
  cursor: pointer;
}

/* 列表视图 */
.photo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.list-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 4px);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.list-row:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}
.list-thumb {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}
.list-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.list-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.list-meta {
  font-size: 12px;
  color: var(--muted-foreground);
}
.list-fav {
  color: var(--tl-red);
  font-size: 13px;
}
.list-size {
  font-size: 12px;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* 列表视图选择勾选 */
.list-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  background: var(--background);
  color: var(--primary-foreground);
  flex-shrink: 0;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}
.list-check.checked {
  background: var(--primary);
  border-color: var(--primary);
}
</style>
