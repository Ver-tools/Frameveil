<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { open } from '@tauri-apps/plugin-dialog';
import { ChevronDown, Grip, List } from 'lucide-vue-next';
import AppShell from '../components/AppShell.vue';
import PhotoGrid from '../components/PhotoGrid.vue';
import Modal from '../components/Modal.vue';
import { albumById, photosOfAlbum, updateAlbum, library, toast } from '../store/library';
import { exportPhotosToDir } from '../utils/exportPhotos';
import { formatBytes } from '../utils/format';

const route = useRoute();
const album = computed(() => albumById(String(route.params.id)));

const view = ref<'grid' | 'list'>(library.settings.defaultView);
const sortDesc = ref(true);

const photos = computed(() => {
  const list = album.value ? photosOfAlbum(album.value.id) : [];
  return [...list].sort((a, b) =>
    sortDesc.value ? b.takenAt.localeCompare(a.takenAt) : a.takenAt.localeCompare(b.takenAt)
  );
});

const totalSize = computed(() => photos.value.reduce((s, p) => s + p.size, 0));

/* ── 导出 ── */
const exporting = ref(false);
const exportProgress = ref(0);
const exportTotal = ref(0);

async function exportAlbum() {
  if (!album.value || exporting.value) return;
  const dir = await open({ directory: true, title: '选择导出位置' });
  if (typeof dir !== 'string') return;
  exporting.value = true;
  exportProgress.value = 0;
  exportTotal.value = photos.value.length;
  try {
    const count = await exportPhotosToDir(photos.value, dir, (done, total) => {
      exportProgress.value = done;
      exportTotal.value = total;
    });
    if (count > 0) toast(`已导出 ${count} 张照片到 ${dir}`, 'success');
  } finally {
    exporting.value = false;
  }
}

/* ── 编辑信息 ── */
const editOpen = ref(false);
const editName = ref('');
const editDesc = ref('');
const editCategory = ref('全部');
const categories = ['全部', '人物', '风景', '街拍', '黑白'];

function openEdit() {
  if (!album.value) return;
  editName.value = album.value.name;
  editDesc.value = album.value.description;
  editCategory.value = album.value.category;
  editOpen.value = true;
}

function saveEdit() {
  if (!album.value) return;
  updateAlbum(album.value.id, {
    name: editName.value.trim() || album.value.name,
    description: editDesc.value.trim(),
    category: editCategory.value,
  });
  editOpen.value = false;
  toast('写真集信息已更新', 'success');
}

/* ── 查看全部：滚动到照片区 ── */
function scrollToPhotos() {
  document.querySelector('.photo-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(() => {
  if (!album.value) toast('写真集不存在', 'error');
});
</script>

<template>
  <AppShell
    v-if="album"
    :title="album.name"
    :back="{ label: '图库', to: '/' }"
  >
    <template #titlebar-right>
      <span class="titlebar-count">{{ photos.length }} 张照片</span>
    </template>

    <div class="collection-header">
      <img class="collection-cover" :src="album.coverSrc" :alt="`${album.name} 写真集封面`" />
      <div class="collection-info">
        <span class="collection-eyebrow">写真集</span>
        <h1 class="collection-title">{{ album.name }}</h1>
        <p class="collection-desc">{{ album.description }}</p>
        <div class="collection-meta">
          <span>{{ photos.length }} 张照片</span>
          <span>{{ album.dateRange }}</span>
          <span>{{ formatBytes(totalSize) }}</span>
        </div>
        <div class="collection-actions">
          <button class="action-btn action-btn-primary" type="button" @click="scrollToPhotos">
            查看全部
          </button>
          <button class="action-btn action-btn-secondary" type="button" @click="exportAlbum">
            导出
          </button>
          <button class="action-btn action-btn-text" type="button" @click="openEdit">编辑信息</button>
        </div>
      </div>
    </div>

    <div class="photo-section">
      <h2 class="section-title">照片</h2>
      <div class="sort-bar">
        <button class="sort-trigger" type="button" @click="sortDesc = !sortDesc">
          <span>{{ sortDesc ? '按日期排序' : '按日期升序' }}</span>
          <ChevronDown :size="14" :style="{ transform: sortDesc ? 'none' : 'rotate(180deg)' }" />
        </button>
        <div class="view-toggle">
          <button
            type="button"
            :class="{ 'is-active': view === 'grid' }"
            aria-label="网格视图"
            @click="view = 'grid'"
          >
            <Grip :size="18" />
          </button>
          <button
            type="button"
            :class="{ 'is-active': view === 'list' }"
            aria-label="列表视图"
            @click="view = 'list'"
          >
            <List :size="18" />
          </button>
        </div>
      </div>

      <PhotoGrid
        :photos="photos"
        :view="view"
        :album-id="album.id"
        :context="{ label: album.name, route: `/album/${album.id}` }"
      />
    </div>

    <!-- 导出进度 -->
    <Modal v-if="exporting" title="正在导出" subtitle="正在将照片导出到所选位置…">
      <div class="export-progress">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${(exportProgress / Math.max(exportTotal, 1)) * 100}%` }"></div>
        </div>
        <span class="progress-text">{{ exportProgress }} / {{ exportTotal }}</span>
      </div>
    </Modal>

    <!-- 编辑写真集信息 -->
    <Modal v-if="editOpen" title="编辑写真集" subtitle="修改写真集名称、描述与分类" @close="editOpen = false">
      <div class="edit-form">
        <label class="modal-field-label" for="edit-name">名称</label>
        <div class="field" style="margin-bottom: 16px">
          <input id="edit-name" class="control" v-model="editName" placeholder="写真集名称" />
        </div>

        <label class="modal-field-label" for="edit-desc">描述</label>
        <textarea
          id="edit-desc"
          v-model="editDesc"
          class="edit-textarea"
          rows="3"
          placeholder="描述这个写真集…"
        ></textarea>

        <div class="category-block">
          <span class="modal-field-label">分类</span>
          <div class="category-chips">
            <button
              v-for="c in categories"
              :key="c"
              class="filter-chip"
              :class="editCategory === c ? 'active' : 'inactive'"
              type="button"
              @click="editCategory = c"
            >
              {{ c }}
            </button>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" type="button" @click="editOpen = false">取消</button>
          <button class="btn btn-primary" type="button" @click="saveEdit">保存</button>
        </div>
      </div>
    </Modal>
  </AppShell>
</template>

<style scoped>
.titlebar-count {
  margin-left: auto;
  color: var(--muted-foreground);
  font-size: 12px;
}

/* 写真集头部 */
.collection-header {
  display: flex;
  gap: 32px;
  padding: 32px;
  border-bottom: 1px solid var(--border);
}
.collection-cover {
  width: 240px;
  height: 180px;
  object-fit: cover;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  flex-shrink: 0;
}
.collection-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}
.collection-eyebrow {
  color: var(--muted-foreground);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.collection-title {
  margin: 8px 0;
  font-size: 32px;
  font-weight: 700;
  color: var(--foreground);
  line-height: 1.15;
}
.collection-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  max-width: 480px;
  color: var(--muted-foreground);
}
.collection-meta {
  display: flex;
  gap: 24px;
  margin-top: 16px;
  font-size: 13px;
  color: var(--muted-foreground);
}
.collection-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  align-items: center;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  border: none;
  border-radius: 999px;
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease, filter 0.18s ease;
}
.action-btn-primary {
  padding: 0 20px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 600;
}
.action-btn-primary:hover {
  filter: brightness(0.96);
}
.action-btn-secondary {
  padding: 0 20px;
  background: var(--secondary);
  color: var(--secondary-foreground);
}
.action-btn-secondary:hover {
  background: var(--muted);
}
.action-btn-text {
  padding: 0 8px;
  background: transparent;
  color: var(--primary);
}
.action-btn-text:hover {
  opacity: 0.75;
}

/* 照片区 */
.photo-section {
  padding: 32px;
}
.section-title {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: var(--foreground);
}
.sort-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.sort-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color 0.18s ease;
}
.sort-trigger:hover {
  background: var(--accent);
}
.view-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.view-toggle button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}
.view-toggle button:hover {
  background: var(--accent);
}
.view-toggle button.is-active {
  background: var(--accent);
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

/* 编辑表单 */
.edit-form {
  display: flex;
  flex-direction: column;
}
.edit-textarea {
  width: 100%;
  border: 1px solid var(--input);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  font: 500 13px/1.5 var(--font-sans);
  padding: 12px 14px;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
  margin-bottom: 16px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.edit-textarea:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 1px var(--ring);
}
.category-block {
  margin-bottom: 4px;
}
.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
