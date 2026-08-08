<script setup lang="ts">
import { computed } from 'vue';
import { Heart } from 'lucide-vue-next';
import AppShell from '../components/AppShell.vue';
import PhotoGrid from '../components/PhotoGrid.vue';
import PhotoBatchBar from '../components/PhotoBatchBar.vue';
import { library, selection, setSelectMode } from '../store/library';

const photos = computed(() =>
  [...library.photos.filter((p) => p.isFavorite && !p.inTrash)].sort((a, b) => b.importedAt - a.importedAt)
);
</script>

<template>
  <AppShell title="Frameveil">
    <div class="page">
      <div class="content-header">
        <div>
          <h1 class="page-title">收藏</h1>
          <p class="subtitle">{{ photos.length }} 张照片</p>
        </div>
        <button
          v-if="photos.length"
          class="select-trigger"
          :class="{ active: selection.active }"
          type="button"
          @click="setSelectMode(!selection.active)"
        >
          {{ selection.active ? '退出选择' : '选择' }}
        </button>
      </div>

      <PhotoGrid
        v-if="photos.length"
        :photos="photos"
        :view="library.settings.defaultView"
        :context="{ label: '收藏', route: '/favorites' }"
      />

      <div v-else class="empty-state">
        <Heart :size="48" class="empty-icon" />
        <p class="empty-title">还没有收藏的照片</p>
        <p class="empty-desc">在图片查看器中点击 ♥ 即可将照片加入收藏</p>
      </div>

      <PhotoBatchBar v-if="selection.active" :photos="photos" />
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
.empty-icon {
  color: var(--muted-foreground);
}
</style>
