<script setup lang="ts">
import { ref, computed } from 'vue';
import { Check } from 'lucide-vue-next';
import AppShell from '../components/AppShell.vue';
import Modal from '../components/Modal.vue';
import {
  library,
  selection,
  setSelectMode,
  selectAllIds,
  clearSelection,
  restorePhoto,
  restoreAllTrash,
  restorePhotos,
  permanentDeletePhoto,
  permanentDeletePhotos,
  emptyTrash,
} from '../store/library';
import { formatBytes, formatTimestamp } from '../utils/format';

const trashed = computed(() =>
  [...library.photos.filter((p) => p.inTrash)].sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0))
);

const allSelected = computed(
  () => trashed.value.length > 0 && trashed.value.every((p) => selection.ids.has(p.id))
);

function toggleAll() {
  if (allSelected.value) clearSelection();
  else selectAllIds(trashed.value.map((p) => p.id));
}

async function onBatchDelete() {
  const ids = [...selection.ids];
  await permanentDeletePhotos(ids);
  clearSelection();
}

function onBatchRestore() {
  restorePhotos([...selection.ids]);
  clearSelection();
}

/* ── 清空回收站二次确认 ── */
const emptyConfirmOpen = ref(false);

function onEmptyTrashConfirm() {
  emptyConfirmOpen.value = false;
  emptyTrash();
}
</script>

<template>
  <AppShell>
    <div class="page">
      <div class="content-header">
        <div>
          <h1 class="page-title">回收站</h1>
          <p class="subtitle">{{ trashed.length }} 张照片</p>
        </div>
        <div v-if="trashed.length" class="header-actions">
          <button
            class="select-trigger"
            :class="{ active: selection.active }"
            type="button"
            @click="setSelectMode(!selection.active)"
          >
            {{ selection.active ? '退出选择' : '选择' }}
          </button>
          <button class="restore-all-btn" type="button" @click="restoreAllTrash">
            全部恢复
          </button>
          <button class="empty-trash-btn" type="button" @click="emptyConfirmOpen = true">
            清空回收站
          </button>
        </div>
      </div>

      <div v-if="trashed.length" class="trash-list">
        <div
          v-for="p in trashed"
          :key="p.id"
          class="trash-row"
          :class="{ selectable: selection.active, checked: selection.active && selection.ids.has(p.id) }"
          @click="selection.active && (selection.ids.has(p.id) ? selection.ids.delete(p.id) : selection.ids.add(p.id))"
        >
          <span v-if="selection.active" class="row-check" :class="{ checked: selection.ids.has(p.id) }">
            <Check v-if="selection.ids.has(p.id)" :size="12" stroke-width="3.5" />
          </span>
          <img class="trash-thumb" :src="p.src" :alt="p.name" loading="lazy" />
          <div class="trash-main">
            <span class="trash-name">{{ p.name }}</span>
            <span class="trash-meta">{{ p.fileName }} · {{ formatBytes(p.size) }}</span>
          </div>
          <span class="trash-date">{{ formatTimestamp(p.trashedAt ?? p.importedAt) }} 移入</span>
          <div v-if="!selection.active" class="trash-actions">
            <button class="pill-btn" type="button" @click.stop="restorePhoto(p.id)">恢复</button>
            <button class="pill-btn pill-danger" type="button" @click.stop="permanentDeletePhoto(p.id)">彻底删除</button>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <p class="empty-desc">回收站是空的</p>
      </div>

      <!-- 批量操作栏 -->
      <div v-if="selection.active && trashed.length" class="batch-bar">
        <span class="batch-count">已选 {{ selection.ids.size }} 张</span>
        <span class="batch-divider"></span>
        <button class="batch-btn" type="button" @click="toggleAll">
          {{ allSelected ? '取消全选' : '全选' }}
        </button>
        <button class="batch-btn" type="button" :disabled="!selection.ids.size" @click="onBatchRestore">
          恢复选中
        </button>
        <button
          class="batch-btn batch-btn-danger"
          type="button"
          :disabled="!selection.ids.size"
          @click="onBatchDelete"
        >
          彻底删除
        </button>
        <button class="batch-btn batch-btn-exit" type="button" @click="setSelectMode(false)">
          取消
        </button>
      </div>

    <!-- 清空回收站二次确认 -->
    <Modal
      v-if="emptyConfirmOpen"
      title="清空回收站"
      :subtitle="`将永久删除回收站中的 ${trashed.length} 张照片，此操作无法撤销`"
      @close="emptyConfirmOpen = false"
    >
      <div class="modal-actions">
        <button class="btn btn-secondary" type="button" @click="emptyConfirmOpen = false">取消</button>
        <button class="btn btn-primary danger-confirm" type="button" @click="onEmptyTrashConfirm">
          确认清空
        </button>
      </div>
    </Modal>
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

/* 选择模式 */
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
.trash-row.selectable {
  cursor: pointer;
}
.trash-row.selectable:hover {
  border-color: var(--primary);
}
.trash-row.checked {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 35%, transparent);
}
.row-check {
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
.row-check.checked {
  background: var(--primary);
  border-color: var(--primary);
}

/* 批量操作栏 */
.batch-bar {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: calc(100vw - 24px);
  padding: 8px 10px;
  border-radius: 999px;
  background: var(--popover);
  color: var(--popover-foreground);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-2xl);
}
.batch-count {
  padding: 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
  white-space: nowrap;
}
.batch-divider {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 6px;
}
.batch-btn {
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--foreground);
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.18s ease;
}
.batch-btn:hover:not(:disabled) {
  background: var(--secondary);
}
.batch-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.batch-btn-danger {
  color: var(--destructive);
}
.batch-btn-danger:hover:not(:disabled) {
  background: var(--state-error-surface);
}
.batch-btn-exit {
  color: var(--muted-foreground);
}
.batch-btn-exit:hover {
  color: var(--foreground);
}

/* 确认清空按钮（危险操作） */
.danger-confirm {
  background: var(--destructive);
  color: var(--destructive-foreground);
}
.danger-confirm:hover:not(:disabled) {
  filter: brightness(0.94);
}
</style>
