<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { Upload, Check, ChevronDown, FileText } from 'lucide-vue-next';
import AppShell from '../components/AppShell.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import { library, runImport, loadImageSize, toast } from '../store/library';
import { formatBytes } from '../utils/format';
import { pickStorageLocation, storageLocationLabel } from '../utils/storage';
import type { PendingFile } from '../types';

const router = useRouter();

const albumName = ref('');
const tagsInput = ref('');
const autoOrganize = ref(true);
const smartAlbum = ref(false);

const pending = ref<PendingFile[]>([]);
const importing = ref(false);
const dragging = ref(false);

/** 存储位置显示文案 */
const storageLabel = computed(() => `默认位置 › ${storageLocationLabel()}`);

const IMAGE_EXTS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tif', 'tiff', 'bmp',
  'raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'orf',
];

function extOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function isPreviewable(ext: string): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tif', 'tiff', 'bmp'].includes(ext);
}

async function addPaths(paths: string[]) {
  const existing = new Set(pending.value.map((f) => f.path));
  const fresh = paths.filter((p) => !existing.has(p));
  if (!fresh.length) return;

  let infos: { path: string; name: string; size: number; modified: number }[] = [];
  try {
    infos = await invoke('get_file_infos', { paths: fresh });
  } catch (e) {
    toast(`读取文件失败：${String(e)}`, 'error');
    return;
  }

  const accepted: PendingFile[] = [];
  for (const info of infos) {
    const ext = extOf(info.name);
    if (!IMAGE_EXTS.includes(ext)) {
      toast(`已跳过不支持的文件：${info.name}`, 'info');
      continue;
    }
    const file: PendingFile = {
      path: info.path,
      name: info.name,
      size: info.size,
      modified: info.modified,
      src: isPreviewable(ext) ? convertFileSrc(info.path) : '',
      width: 0,
      height: 0,
      format: ext === 'jpg' || ext === 'jpeg' ? 'JPG' : ext.toUpperCase(),
    };
    accepted.push(file);
  }

  // 读取图片尺寸（用于照片比例）
  await Promise.all(
    accepted.map(async (f) => {
      if (!f.src) return;
      const { width, height } = await loadImageSize(f.src);
      f.width = width;
      f.height = height;
    })
  );

  pending.value = [...pending.value, ...accepted];
}

async function pickFiles() {
  const selected = await open({
    multiple: true,
    title: '选择要导入的照片',
    filters: [
      { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tif', 'tiff', 'raw', 'cr2', 'nef', 'arw', 'dng'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (Array.isArray(selected) && selected.length) {
    addPaths(selected.filter((s): s is string => typeof s === 'string'));
  }
}

const totalSize = computed(() => pending.value.reduce((s, f) => s + f.size, 0));

async function doImport() {
  if (!pending.value.length) {
    toast('请先选择要导入的照片', 'info');
    return;
  }
  importing.value = true;
  try {
    const name = albumName.value.trim() || `写真集 ${new Date().toISOString().slice(0, 10)}`;
    const tags = tagsInput.value
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const album = await runImport({
      files: pending.value,
      albumName: name,
      tags,
    });
    if (album) {
      router.push(`/album/${album.id}`);
    }
  } finally {
    importing.value = false;
  }
}

/* ── 拖放 ── */
let unlisten: (() => void) | undefined;
onMounted(async () => {
  // 尚未设置存储位置时，初始化为默认图库目录
  if (!library.settings.storageLocation) {
    try {
      const libDir = await invoke<string>('library_dir');
      if (libDir) library.settings.storageLocation = libDir;
    } catch {
      /* 桌面环境下失败则保留默认文案 */
    }
  }
  try {
    unlisten = await getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === 'over') dragging.value = true;
      else if (event.payload.type === 'leave') dragging.value = false;
      else if (event.payload.type === 'drop') {
        dragging.value = false;
        addPaths(event.payload.paths);
      }
    });
  } catch {
    /* 非 Tauri 环境（纯浏览器预览）无拖放能力 */
  }
});

onUnmounted(() => {
  unlisten?.();
});
</script>

<template>
  <AppShell title="导入照片">
    <template #titlebar-right>
      <button class="titlebar-cancel" type="button" @click="router.push('/')">取消</button>
    </template>

    <div class="page">
      <h1 class="page-title">导入照片</h1>
      <p class="page-sub">将照片导入到你的 Frameveil 图库</p>

      <!-- 拖放区域 -->
      <div class="drop-zone" :class="{ dragging }">
        <Upload :size="48" class="drop-icon" />
        <div class="drop-title">拖放照片到此处</div>
        <div class="drop-or">或</div>
        <button class="upload-btn" type="button" @click="pickFiles">选择文件</button>
        <div class="drop-hint">支持 RAW、JPEG、HEIC、TIFF 格式</div>
      </div>

      <!-- 导入设置 -->
      <div class="settings-card">
        <div class="card-title">导入设置</div>

        <div class="setting-row">
          <label class="row-label" for="inp-name">写真集名称</label>
          <div class="field row-field">
            <input id="inp-name" class="control" v-model="albumName" placeholder="新写真集" aria-label="写真集名称" />
          </div>
        </div>

        <div class="setting-row">
          <label class="row-label" for="inp-tags">标签</label>
          <div class="field row-field">
            <input id="inp-tags" class="control" v-model="tagsInput" placeholder="添加标签，用逗号分隔" aria-label="标签" />
          </div>
        </div>

        <div class="setting-row">
          <span class="row-label">存储位置</span>
          <div class="storage-select" title="点击选择存储位置" @click="pickStorageLocation()">
            <span class="storage-text">{{ storageLabel }}</span>
            <ChevronDown :size="16" style="color: var(--muted-foreground); flex-shrink: 0" />
          </div>
        </div>

        <div class="setting-row">
          <span class="row-label">导入后自动整理</span>
          <div class="row-control">
            <ToggleSwitch v-model="autoOrganize" label="导入后自动整理" />
          </div>
        </div>

        <div class="setting-row">
          <span class="row-label">创建智能相册</span>
          <div class="row-control">
            <ToggleSwitch v-model="smartAlbum" label="创建智能相册" />
          </div>
        </div>
      </div>

      <!-- 文件列表 -->
      <div class="file-section">
        <div class="file-heading">已选择 {{ pending.length }} 个文件</div>
        <div class="file-list">
          <div v-for="f in pending" :key="f.path" class="file-row">
            <img v-if="f.src" :src="f.src" alt="" class="file-thumb" />
            <div v-else class="file-thumb file-thumb-fallback">
              <FileText :size="20" />
            </div>
            <span class="file-name">{{ f.name }}</span>
            <span class="file-size">{{ formatBytes(f.size) }}</span>
            <span class="file-status">
              <Check :size="14" />
              就绪
            </span>
          </div>
          <div v-if="!pending.length" class="file-empty">尚未选择任何文件</div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="bottom-bar">
        <span class="bottom-total">总计 {{ pending.length }} 个文件 · {{ formatBytes(totalSize) }}</span>
        <div class="bottom-actions">
          <button class="cancel-btn" type="button" @click="router.push('/')">取消</button>
          <button class="import-btn" type="button" :disabled="importing || !pending.length" @click="doImport">
            {{ importing ? '导入中…' : '导入' }}
          </button>
        </div>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.page {
  padding: 40px;
}
.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0 0 8px;
}
.page-sub {
  font-size: 14px;
  color: var(--muted-foreground);
  margin: 0 0 32px;
}

/* 拖放区域 */
.drop-zone {
  border: 2px dashed var(--input);
  border-radius: var(--radius);
  padding: 48px;
  text-align: center;
  background: var(--accent);
  margin-bottom: 32px;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}
.drop-zone:hover,
.drop-zone.dragging {
  border-color: var(--primary);
  background: var(--secondary);
}
.drop-icon {
  color: var(--muted-foreground);
}
.drop-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
  margin-top: 16px;
}
.drop-or {
  font-size: 13px;
  color: var(--muted-foreground);
  margin: 8px 0;
}
.upload-btn {
  background: var(--primary);
  color: var(--primary-foreground);
  border-radius: 999px;
  padding: 0 20px;
  height: 36px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-family: var(--font-sans);
  transition: filter 0.18s ease;
}
.upload-btn:hover {
  filter: brightness(0.96);
}
.drop-hint {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 12px;
}

/* 导入设置卡片 */
.settings-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);
}
.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
  margin-bottom: 20px;
}
.setting-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  align-items: center;
}
.setting-row:last-child {
  margin-bottom: 0;
}
.row-label {
  font-size: 13px;
  color: var(--foreground);
  font-weight: 500;
  min-width: 100px;
  flex-shrink: 0;
}
.row-field {
  flex: 1;
  height: 40px;
}
.row-control {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}
.storage-select {
  background: var(--secondary);
  border-radius: var(--radius);
  padding: 0 16px;
  height: 40px;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  font-size: 13px;
  color: var(--foreground);
  transition: background-color 0.18s ease;
}
.storage-select:hover {
  background: var(--sidebar-accent);
}
.storage-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 文件列表 */
.file-section {
  margin-bottom: 24px;
}
.file-heading {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
  margin-bottom: 12px;
}
.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 4px);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.file-row:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}
.file-thumb {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--secondary);
}
.file-thumb-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-foreground);
}
.file-name {
  font-size: 13px;
  color: var(--foreground);
  flex: 1;
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-size {
  font-size: 12px;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.file-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--state-success);
  font-size: 12px;
  flex-shrink: 0;
}
.file-empty {
  padding: 24px;
  text-align: center;
  color: var(--muted-foreground);
  font-size: 13px;
  border: 1px dashed var(--border);
  border-radius: calc(var(--radius) - 4px);
}

/* 底部操作栏 */
.bottom-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
.bottom-total {
  font-size: 13px;
  color: var(--muted-foreground);
}
.bottom-actions {
  display: flex;
  gap: 12px;
}
.cancel-btn {
  background: transparent;
  color: var(--muted-foreground);
  font-size: 13px;
  height: 36px;
  padding: 0 16px;
  cursor: pointer;
  border: none;
  border-radius: 8px;
  font-family: var(--font-sans);
  transition: color 0.18s ease, background-color 0.18s ease;
}
.cancel-btn:hover {
  color: var(--foreground);
  background: var(--secondary);
}
.import-btn {
  background: var(--primary);
  color: var(--primary-foreground);
  border-radius: 999px;
  height: 36px;
  padding: 0 24px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-family: var(--font-sans);
  transition: filter 0.18s ease, opacity 0.18s ease;
}
.import-btn:hover:not(:disabled) {
  filter: brightness(0.96);
}
.import-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}
</style>
