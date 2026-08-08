<script setup lang="ts">
import { ref, computed } from 'vue';
import AppShell from '../components/AppShell.vue';
import PhotoGrid from '../components/PhotoGrid.vue';
import { allTags, library } from '../store/library';

const activeTag = ref('');

const tags = allTags;

const photos = computed(() => {
  if (!activeTag.value) return [];
  return library.photos.filter((p) => !p.inTrash && p.tags.includes(activeTag.value));
});
</script>

<template>
  <AppShell title="Frameveil">
    <div class="page">
      <div class="content-header">
        <div>
          <h1 class="page-title">标签</h1>
          <p class="subtitle">{{ activeTag ? `${photos.length} 张照片` : `${tags.length} 个标签` }}</p>
        </div>
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

      <div v-if="activeTag" class="tag-photos">
        <PhotoGrid :photos="photos" :view="library.settings.defaultView" :context="{ label: `标签：${activeTag}`, route: '/tags' }" />
      </div>
      <div v-else-if="tags.length" class="empty-state">
        <p class="empty-desc">选择一个标签以查看对应的照片</p>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.page {
  padding: 32px;
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
</style>
