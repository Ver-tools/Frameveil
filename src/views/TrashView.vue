<script setup lang="ts">
import { computed } from 'vue';
import AppShell from '../components/AppShell.vue';
import {
  library,
  restorePhoto,
  restoreAllTrash,
  permanentDeletePhoto,
  emptyTrash,
} from '../store/library';
import { formatBytes, formatTimestamp } from '../utils/format';

const trashed = computed(() =>
  [...library.photos.filter((p) => p.inTrash)].sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0))
);
</script>

<template>
  <AppShell title="Frameveil">
    <div class="page">
      <div class="content-header">
        <div>
          <h1 class="page-title">回收站</h1>
          <p class="subtitle">{{ trashed.length }} 张照片</p>
        </div>
        <div v-if="trashed.length" class="header-actions">
          <button class="restore-all-btn" type="button" @click="restoreAllTrash">
            全部恢复
          </button>
          <button class="empty-trash-btn" type="button" @click="emptyTrash">
            清空回收站
          </button>
        </div>
      </div>

      <div v-if="trashed.length" class="trash-list">
        <div v-for="p in trashed" :key="p.id" class="trash-row">
          <img class="trash-thumb" :src="p.src" :alt="p.name" loading="lazy" />
          <div class="trash-main">
            <span class="trash-name">{{ p.name }}</span>
            <span class="trash-meta">{{ p.fileName }} · {{ formatBytes(p.size) }}</span>
          </div>
          <span class="trash-date">{{ formatTimestamp(p.trashedAt ?? p.importedAt) }} 移入</span>
          <div class="trash-actions">
            <button class="pill-btn" type="button" @click="restorePhoto(p.id)">恢复</button>
            <button class="pill-btn pill-danger" type="button" @click="permanentDeletePhoto(p.id)">彻底删除</button>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <p class="empty-desc">回收站是空的</p>
      </div>
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
.empty-trash-btn {
  background: transparent;
  color: var(--destructive);
  border: 1px solid color-mix(in srgb, var(--destructive) 40%, transparent);
  border-radius: 999px;
  height: 32px;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}
.empty-trash-btn:hover {
  background: var(--state-error-surface);
}
.header-actions {
  display: flex;
  gap: 10px;
}
.restore-all-btn {
  background: var(--secondary);
  color: var(--secondary-foreground);
  border: none;
  border-radius: 999px;
  height: 32px;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color 0.18s ease;
}
.restore-all-btn:hover {
  background: var(--muted);
}
.trash-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.trash-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding: 10px 14px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: border-color 0.18s ease;
}
.trash-row:hover {
  border-color: var(--destructive);
}
.trash-thumb {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}
.trash-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.trash-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trash-meta {
  font-size: 12px;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
}
.trash-date {
  font-size: 12px;
  color: var(--muted-foreground);
  flex-shrink: 0;
}
.trash-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.pill-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--secondary);
  color: var(--secondary-foreground);
  font-size: 12px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: background-color 0.18s ease, filter 0.18s ease;
}
.pill-btn:hover {
  filter: brightness(0.97);
}
.pill-danger {
  background: var(--state-error-surface);
  color: var(--destructive);
}
.pill-danger:hover {
  background: var(--destructive);
  color: var(--destructive-foreground);
  filter: none;
}
</style>
