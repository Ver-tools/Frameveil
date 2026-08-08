<script setup lang="ts">
import { computed } from 'vue';
import { Clock } from 'lucide-vue-next';
import AppShell from '../components/AppShell.vue';
import PhotoGrid from '../components/PhotoGrid.vue';
import PhotoBatchBar from '../components/PhotoBatchBar.vue';
import { library, selection, setSelectMode } from '../store/library';
import type { Photo } from '../types';

const photos = computed(() =>
  [...library.photos.filter((p) => !p.inTrash)].sort((a, b) => b.importedAt - a.importedAt)
);

/** 按拍摄/导入时间分组：今天 / 昨天 / 本周 / 更早 */
const groups = computed(() => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86400000;
  const buckets: { name: string; photos: Photo[] }[] = [
    { name: '今天', photos: [] },
    { name: '昨天', photos: [] },
    { name: '本周', photos: [] },
    { name: '更早', photos: [] },
  ];
  for (const p of photos.value) {
    const t = new Date(`${p.takenAt}T00:00:00`).getTime() || p.importedAt;
    if (t >= startOfToday) buckets[0].photos.push(p);
    else if (t >= startOfToday - day) buckets[1].photos.push(p);
    else if (t >= startOfToday - 7 * day) buckets[2].photos.push(p);
    else buckets[3].photos.push(p);
  }
  return buckets.filter((b) => b.photos.length > 0);
});

function selectModeActive() {
  return selection.active;
}
</script>

<template>
  <AppShell title="Frameveil">
    <div class="page">
      <div class="content-header">
        <div>
          <h1 class="page-title">最近</h1>
          <p class="subtitle">{{ photos.length }} 张照片</p>
        </div>
        <button
          v-if="photos.length"
          class="select-trigger"
          :class="{ active: selectModeActive() }"
          type="button"
          @click="setSelectMode(!selectModeActive())"
        >
          {{ selectModeActive() ? '退出选择' : '选择' }}
        </button>
      </div>

      <template v-if="photos.length">
        <section v-for="g in groups" :key="g.name" class="group-section">
          <h2 class="group-title">{{ g.name }} · {{ g.photos.length }}</h2>
          <PhotoGrid
            :photos="g.photos"
            :view="library.settings.defaultView"
            :context="{ label: '最近', route: '/recent' }"
          />
        </section>
      </template>

      <div v-else class="empty-state">
        <Clock :size="48" class="empty-icon" />
        <p class="empty-title">暂无照片</p>
        <p class="empty-desc">导入照片后，将在这里按时间排列展示</p>
      </div>

      <PhotoBatchBar v-if="selectModeActive()" :photos="photos" />
    </div>
  </AppShell>
</template>

<style scoped>
.page {
  padding: 32px clamp(20px, 3vw, 32px);
}
.content-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}
.page-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: var(--foreground);
  line-height: 1.2;
}
.subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--muted-foreground);
}
.select-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: var(--secondary);
  color: var(--secondary-foreground);
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}
.select-trigger:hover {
  background: var(--muted);
}
.select-trigger.active {
  background: var(--primary);
  color: var(--primary-foreground);
}
.group-section {
  margin-bottom: 28px;
}
.group-section:last-child {
  margin-bottom: 0;
}
.group-title {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--muted-foreground);
  letter-spacing: 0.02em;
}
.empty-icon {
  color: var(--muted-foreground);
}
</style>
