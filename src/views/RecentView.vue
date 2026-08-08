<script setup lang="ts">
import { computed } from 'vue';
import AppShell from '../components/AppShell.vue';
import PhotoGrid from '../components/PhotoGrid.vue';
import { library } from '../store/library';

const photos = computed(() =>
  [...library.photos.filter((p) => !p.inTrash)].sort((a, b) => b.importedAt - a.importedAt)
);
</script>

<template>
  <AppShell title="Frameveil">
    <div class="page">
      <div class="content-header">
        <div>
          <h1 class="page-title">最近</h1>
          <p class="subtitle">{{ photos.length }} 张照片</p>
        </div>
      </div>
      <PhotoGrid :photos="photos" :view="library.settings.defaultView" :context="{ label: '最近', route: '/recent' }" />
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
</style>
