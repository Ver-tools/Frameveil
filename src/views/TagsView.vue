<script setup lang="ts">
import { ref, computed } from 'vue';
import { Tag } from 'lucide-vue-next';
import AppShell from '../components/AppShell.vue';
import PhotoGrid from '../components/PhotoGrid.vue';
import PhotoBatchBar from '../components/PhotoBatchBar.vue';
import { allTags, library, selection, setSelectMode } from '../store/library';

const activeTag = ref('');

const tags = allTags;

const photos = computed(() => {
  if (!activeTag.value) return [];
  return library.photos.filter((p) => !p.inTrash && p.tags.includes(activeTag.value));
});
</script>

<template>
  <AppShell>
    <div class="page">
      <div class="content-header">
        <div>
          <h1 class="page-title">标签</h1>
          <p class="subtitle">{{ activeTag ? `${photos.length} 张照片` : `${tags.length} 个标签` }}</p>
        </div>
        <button
          v-if="activeTag && photos.length"
          class="select-trigger"
          :class="{ active: selection.active }"
          type="button"
          @click="setSelectMode(!selection.active)"
        >
          {{ selection.active ? '退出选择' : '选择' }}
        </button>
      </div>

      <div class="tag-bar">
        <button
          v-for="t in tags"
          :key="t.name"
          class="filter-chip"
          :class="activeTag === t.name ? 'active' : 'inactive'"
          type="button"
          @click="activeTag = activeTag === t.name ? '' : t.name"
        >
          {{ t.name }} · {{ t.count }}
        </button>
        <span v-if="!tags.length" class="tag-empty">暂无标签</span>
      </div>

      <PhotoGrid
        v-if="activeTag && photos.length"
        :photos="photos"
        :view="library.settings.defaultView"
        :context="{ label: `标签：${activeTag}`, route: '/tags' }"
      />

      <div v-else-if="tags.length" class="empty-state">
        <Tag :size="48" class="empty-icon" />
        <p class="empty-desc">选择一个标签以查看对应的照片</p>
      </div>

      <div v-else class="empty-state">
        <Tag :size="48" class="empty-icon" />
        <p class="empty-title">暂无标签</p>
        <p class="empty-desc">编辑照片信息即可为照片添加标签</p>
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
.tag-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}
.tag-empty {
  font-size: 13px;
  color: var(--muted-foreground);
}
.empty-icon {
  color: var(--muted-foreground);
}
</style>
