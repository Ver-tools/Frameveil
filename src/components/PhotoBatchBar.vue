<script setup lang="ts">
import { ref, computed } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { Heart, Trash2, Download, CheckSquare, X, Tag } from 'lucide-vue-next';
import Modal from './Modal.vue';
import {
  selection,
  setSelectMode,
  selectAllIds,
  favoritePhotos,
  trashPhotos,
  addTagsToPhotos,
  toast,
} from '../store/library';
import { exportPhotosToDir } from '../utils/exportPhotos';
import type { Photo } from '../types';

const props = defineProps<{ photos: Photo[] }>();

const count = computed(() => selection.ids.size);
const allSelected = computed(
  () => props.photos.length > 0 && props.photos.every((p) => selection.ids.has(p.id))
);

/** 当前可见照片中已选中的照片 */
const selectedPhotos = computed(() => props.photos.filter((p) => selection.ids.has(p.id)));

function toggleAll() {
  if (allSelected.value) selectAllIds([]);
  else selectAllIds(props.photos.map((p) => p.id));
}

function onFavorite() {
  favoritePhotos(selection.ids, true);
}

function onDelete() {
  const ids = [...selection.ids];
  trashPhotos(ids);
  selection.ids.clear();
}

function exit() {
  setSelectMode(false);
}

/* ── 批量添加标签 ── */
const tagOpen = ref(false);
const tagInput = ref('');

function openTagModal() {
  tagInput.value = '';
  tagOpen.value = true;
}

function applyTags() {
  const tags = tagInput.value
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
  addTagsToPhotos(selection.ids, tags);
  tagOpen.value = false;
}

/* ── 批量导出 ── */
const exporting = ref(false);
const exportProgress = ref(0);
const exportTotal = ref(0);

async function onExport() {
  const list = selectedPhotos.value;
  if (!list.length) return;
  let dir: string | string[] | null = null;
  try {
    dir = await open({ directory: true, title: '选择导出位置' });
  } catch {
    toast('当前环境不支持选择目录', 'error');
    return;
  }
  if (typeof dir !== 'string') return;
  exporting.value = true;
  exportProgress.value = 0;
  exportTotal.value = list.length;
  try {
    const n = await exportPhotosToDir(list, dir, (done, total) => {
      exportProgress.value = done;
      exportTotal.value = total;
    });
    if (n) toast(`已导出 ${n} 张照片到 ${dir}`, 'success');
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="batch-bar">
    <span class="batch-count">已选 {{ count }} 张</span>
    <span class="batch-divider"></span>
    <button class="batch-btn" type="button" @click="toggleAll">
      <CheckSquare :size="16" />
      <span>{{ allSelected ? '取消全选' : '全选' }}</span>
    </button>
    <button class="batch-btn" type="button" @click="onFavorite">
      <Heart :size="16" />
      <span>收藏</span>
    </button>
    <button class="batch-btn" type="button" @click="openTagModal">
      <Tag :size="16" />
      <span>标签</span>
    </button>
    <button class="batch-btn" type="button" @click="onDelete">
      <Trash2 :size="16" style="color: var(--state-error)" />
      <span>删除</span>
    </button>
    <button class="batch-btn" type="button" @click="onExport">
      <Download :size="16" />
      <span>导出</span>
    </button>
    <button class="batch-btn batch-btn-exit" type="button" @click="exit">
      <X :size="16" />
      <span>取消</span>
    </button>
  </div>

  <!-- 批量添加标签 -->
  <Modal v-if="tagOpen" title="批量添加标签" :subtitle="`将标签添加到选中的 ${count} 张照片`" @close="tagOpen = false">
    <div class="tag-form">
      <label class="modal-field-label" for="batch-tags">标签</label>
      <div class="field">
        <input id="batch-tags" class="control" v-model="tagInput" placeholder="用逗号分隔多个标签" />
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" type="button" @click="tagOpen = false">取消</button>
        <button class="btn btn-primary" type="button" @click="applyTags">添加</button>
      </div>
    </div>
  </Modal>

  <!-- 批量导出进度 -->
  <Modal v-if="exporting" title="正在导出" subtitle="正在将选中的照片导出到所选位置…">
    <div class="export-progress">
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: `${(exportProgress / Math.max(exportTotal, 1)) * 100}%` }"></div>
      </div>
      <span class="progress-text">{{ exportProgress }} / {{ exportTotal }}</span>
    </div>
  </Modal>
</template>

<style scoped>
.batch-bar {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px;
  max-width: calc(100vw - 24px);
  padding: 8px 10px;
  border-radius: 999px;
  background: var(--popover);
  color: var(--popover-foreground);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-2xl);
  animation: batch-in 0.22s ease;
}
@keyframes batch-in {
  from {
    opacity: 0;
    transform: translate(-50%, 10px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
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
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--foreground);
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color 0.18s ease;
  white-space: nowrap;
}
.batch-btn:hover {
  background: var(--secondary);
}
.batch-btn-exit {
  color: var(--muted-foreground);
}
.batch-btn-exit:hover {
  color: var(--foreground);
}

/* 导出进度 */
.export-progress {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.progress-track {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--secondary);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--primary);
  transition: width 0.18s ease;
}
.progress-text {
  font-size: 12px;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  text-align: right;
}
</style>
