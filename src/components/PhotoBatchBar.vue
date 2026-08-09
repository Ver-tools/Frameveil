<script setup lang="ts">
import { ref, computed } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { Heart, Trash2, Download, CheckSquare, X, Tag, FolderInput } from 'lucide-vue-next';
import Modal from './Modal.vue';
import {
  selection,
  setSelectMode,
  selectAllIds,
  favoritePhotos,
  trashPhotos,
  addTagsToPhotos,
  movePhotosToAlbum,
  albumsWithCounts,
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

/** 选中照片是否已全部收藏（用于切换收藏按钮文案） */
const allFavorited = computed(
  () =>
    selectedPhotos.value.length > 0 &&
    selectedPhotos.value.every((p) => p.isFavorite)
);

function toggleAll() {
  if (allSelected.value) selectAllIds([]);
  else selectAllIds(props.photos.map((p) => p.id));
}

function onFavorite() {
  favoritePhotos(selection.ids, !allFavorited.value);
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

/* ── 批量移动到写真集 ── */
const moveOpen = ref(false);
const targetAlbumId = ref('');

/** 可选目标写真集（排除当前选中照片所属的写真集，避免无意义移动） */
const targetAlbums = computed(() => {
  const currentIds = new Set<string>();
  for (const p of props.photos) {
    if (selection.ids.has(p.id)) currentIds.add(p.albumId);
  }
  return albumsWithCounts.value.filter((a) => !currentIds.has(a.id) || currentIds.size > 1);
});

function openMoveModal() {
  if (!count.value) return;
  targetAlbumId.value = '';
  moveOpen.value = true;
}

function applyMove() {
  if (!targetAlbumId.value) {
    toast('请选择目标写真集', 'info');
    return;
  }
  movePhotosToAlbum([...selection.ids], targetAlbumId.value);
  moveOpen.value = false;
  setSelectMode(false);
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
      <Heart :size="16" :fill="allFavorited ? 'currentColor' : 'none'" />
      <span>{{ allFavorited ? '取消收藏' : '收藏' }}</span>
    </button>
    <button class="batch-btn" type="button" @click="openTagModal">
      <Tag :size="16" />
      <span>标签</span>
    </button>
    <button class="batch-btn" type="button" :disabled="!count" @click="openMoveModal">
      <FolderInput :size="16" />
      <span>移动到</span>
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

  <!-- 批量移动到写真集 -->
  <Modal v-if="moveOpen" title="移动到写真集" :subtitle="`将选中的 ${count} 张照片移动到目标写真集`" @close="moveOpen = false">
    <div class="move-form">
      <label class="modal-field-label" for="batch-album">目标写真集</label>
      <div v-if="targetAlbums.length" class="album-pick-list">
        <button
          v-for="a in targetAlbums"
          :key="a.id"
          class="album-pick"
          :class="{ active: targetAlbumId === a.id }"
          type="button"
          @click="targetAlbumId = a.id"
        >
          <span class="album-pick-name">{{ a.name }}</span>
          <span class="album-pick-meta">{{ a.photoCount }} 张 · {{ a.period }}</span>
        </button>
      </div>
      <p v-else class="move-empty">没有可用的目标写真集</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" type="button" @click="moveOpen = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="!targetAlbumId" @click="applyMove">移动</button>
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

/* 按钮禁用态 */
.batch-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.batch-btn:disabled:hover {
  background: transparent;
}

/* 移动到写真集 */
.move-form {
  display: flex;
  flex-direction: column;
}
.album-pick-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
  margin-bottom: 16px;
}
.album-pick {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
  color: var(--foreground);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease;
}
.album-pick:hover {
  border-color: var(--primary);
}
.album-pick.active {
  border-color: var(--primary);
  background: var(--accent);
}
.album-pick-name {
  font-size: 13px;
  font-weight: 600;
}
.album-pick-meta {
  font-size: 12px;
  color: var(--muted-foreground);
}
.move-empty {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--muted-foreground);
}
</style>
