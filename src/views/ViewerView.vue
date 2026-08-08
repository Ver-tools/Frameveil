<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import {
  Heart,
  PenLine,
  Share2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-vue-next';
import Modal from '../components/Modal.vue';
import {
  library,
  photoById,
  photosOfAlbum,
  toggleFavorite,
  trashPhoto,
  updatePhoto,
  toast,
} from '../store/library';
import { formatBytes, formatDate } from '../utils/format';

const route = useRoute();
const router = useRouter();

const pid = computed(() => String(route.params.pid));

const ctx = computed(() => library.viewerContext);

/** 当前照片列表（优先使用查看器上下文） */
const photos = computed(() => {
  if (ctx.value && ctx.value.photos.length) return ctx.value.photos;
  const albumId = route.query.album;
  if (albumId) return photosOfAlbum(String(albumId));
  const p = photoById(pid.value);
  return p ? [p] : [];
});

const index = computed(() => {
  const i = photos.value.findIndex((p) => p.id === pid.value);
  return i >= 0 ? i : 0;
});

const photo = computed(() => photos.value[index.value] ?? null);

const albumName = computed(() => {
  const albumId = String(ctx.value?.albumId || route.query.album || '');
  if (!albumId) return '';
  return library.albums.find((a) => a.id === albumId)?.name ?? '';
});

const backTarget = computed(() => {
  if (ctx.value?.back) return ctx.value.back;
  if (albumName.value) return { label: albumName.value, route: `/album/${ctx.value?.albumId || route.query.album}` };
  return { label: '图库', route: '/' };
});

const centerLabel = computed(() => backTarget.value.label || '照片');

function goto(i: number) {
  const next = photos.value[i];
  if (!next) return;
  library.viewerContext = {
    photos: ctx.value?.photos ?? photos.value.map((p) => ({ ...p })),
    index: i,
    albumId: ctx.value?.albumId ?? (route.query.album as string | undefined),
    back: ctx.value?.back,
  };
  router.replace(`/viewer/${next.id}`);
}

function prev() {
  if (photos.value.length > 1) goto((index.value - 1 + photos.value.length) % photos.value.length);
}
function next() {
  if (photos.value.length > 1) goto((index.value + 1) % photos.value.length);
}

function goBack() {
  router.push(backTarget.value.route);
}

/* ── 分享：在文件管理器中显示 ── */
async function share() {
  const p = photo.value;
  if (!p) return;
  if (p.path && !p.builtin) {
    try {
      await revealItemInDir(p.path);
    } catch {
      toast('无法在文件管理器中显示该文件', 'error');
    }
  } else {
    toast('内置示例照片，可在导出后查看', 'info');
  }
}

/* ── 删除：移入回收站 ── */
function remove() {
  const p = photo.value;
  if (!p) return;
  trashPhoto(p.id);
  if (photos.value.length > 1) {
    const nextIndex = index.value >= photos.value.length - 1 ? index.value - 1 : index.value;
    goto(nextIndex);
  } else {
    goBack();
  }
}

/* ── 编辑 ── */
const editOpen = ref(false);
const editName = ref('');
const editDesc = ref('');
const editTags = ref('');

function openEdit() {
  const p = photo.value;
  if (!p) return;
  editName.value = p.name;
  editDesc.value = p.description;
  editTags.value = p.tags.join(', ');
  editOpen.value = true;
}

function saveEdit() {
  const p = photo.value;
  if (!p) return;
  const tags = editTags.value
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
  updatePhoto(p.id, { name: editName.value.trim() || p.name, description: editDesc.value.trim(), tags });
  editOpen.value = false;
  toast('照片信息已更新', 'success');
}

/* ── 键盘导航 ── */
function onKeydown(e: KeyboardEvent) {
  if (editOpen.value) return;
  if (e.key === 'ArrowLeft') prev();
  else if (e.key === 'ArrowRight') next();
  else if (e.key === 'Escape') goBack();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

const infoRows = computed(() => {
  const p = photo.value;
  if (!p) return [];
  const rows: { label: string; value: string }[] = [];
  if (p.camera) rows.push({ label: '相机', value: p.camera });
  if (p.lens) rows.push({ label: '镜头', value: p.lens });
  if (p.aperture) rows.push({ label: '光圈', value: p.aperture });
  if (p.shutter) rows.push({ label: '快门', value: p.shutter });
  if (p.iso) rows.push({ label: 'ISO', value: p.iso });
  if (p.focalLength) rows.push({ label: '焦距', value: p.focalLength });
  return rows;
});
</script>

<template>
  <div v-if="photo" class="viewer-shell">
    <header class="title-bar">
      <div class="tl-dots" aria-hidden="true">
        <span class="tl-dot tl-red"></span>
        <span class="tl-dot tl-yellow"></span>
        <span class="tl-dot tl-green"></span>
      </div>
      <button class="back-link" type="button" @click="goBack">
        <ArrowLeft :size="16" />
        <span>{{ backTarget.label }}</span>
      </button>
      <span class="title-center">{{ centerLabel }} {{ String(index + 1).padStart(2, '0') }} / {{ photos.length }}</span>
      <div class="title-right">
        <button
          class="tb-icon"
          :class="{ fav: photo.isFavorite }"
          aria-label="收藏"
          :title="photo.isFavorite ? '取消收藏' : '收藏'"
          @click="toggleFavorite(photo.id)"
        >
          <Heart :size="18" :fill="photo.isFavorite ? 'currentColor' : 'none'" />
        </button>
        <button class="tb-icon" aria-label="编辑" title="编辑" @click="openEdit">
          <PenLine :size="18" />
        </button>
        <button class="tb-icon" aria-label="分享" title="分享" @click="share">
          <Share2 :size="18" />
        </button>
        <span class="tb-divider"></span>
        <button class="tb-icon" aria-label="删除" title="删除" style="color: var(--state-error)" @click="remove">
          <Trash2 :size="18" />
        </button>
      </div>
    </header>

    <div class="viewer-body">
      <div class="viewer-nav" style="background: var(--background)">
        <button class="nav-circle" aria-label="上一张" @click="prev">
          <ChevronLeft :size="20" />
        </button>
      </div>

      <div class="viewer-center">
        <div class="viewer-image-wrap">
          <img class="viewer-image" :src="photo.src" :alt="photo.name" />
        </div>
        <div class="viewer-counter">{{ index + 1 }} / {{ photos.length }}</div>
      </div>

      <div class="viewer-nav">
        <button class="nav-circle" aria-label="下一张" @click="next">
          <ChevronRight :size="20" />
        </button>
      </div>

      <aside class="viewer-meta">
        <h1 class="meta-title">{{ photo.name }}</h1>
        <p class="meta-date">{{ formatDate(photo.takenAt) }}</p>

        <section v-if="infoRows.length" class="meta-section">
          <div class="meta-eyebrow">基本信息</div>
          <div v-for="row in infoRows" :key="row.label" class="info-row">
            <span class="info-label">{{ row.label }}</span>
            <span class="info-value">{{ row.value }}</span>
          </div>
        </section>

        <section v-if="photo.tags.length" class="meta-section">
          <div class="meta-eyebrow">标签</div>
          <div class="tag-list">
            <span v-for="t in photo.tags" :key="t" class="tag-chip">{{ t }}</span>
          </div>
        </section>

        <section v-if="photo.description" class="meta-section">
          <div class="meta-eyebrow meta-eyebrow-desc">描述</div>
          <p class="meta-desc">{{ photo.description }}</p>
        </section>

        <section class="meta-section">
          <div class="meta-eyebrow">文件信息</div>
          <div class="info-row">
            <span class="info-label">文件名</span>
            <span class="info-value info-value-mono">{{ photo.fileName }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">尺寸</span>
            <span class="info-value">{{ photo.width }} × {{ photo.height }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">大小</span>
            <span class="info-value">{{ formatBytes(photo.size) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">格式</span>
            <span class="info-value">{{ photo.format }}</span>
          </div>
        </section>
      </aside>
    </div>

    <!-- 编辑照片信息 -->
    <Modal v-if="editOpen" title="编辑照片" subtitle="修改照片名称、描述与标签" @close="editOpen = false">
      <div class="edit-form">
        <label class="modal-field-label" for="edit-photo-name">名称</label>
        <div class="field" style="margin-bottom: 16px">
          <input id="edit-photo-name" class="control" v-model="editName" placeholder="照片名称" />
        </div>

        <label class="modal-field-label" for="edit-photo-tags">标签</label>
        <div class="field" style="margin-bottom: 16px">
          <input id="edit-photo-tags" class="control" v-model="editTags" placeholder="用逗号分隔多个标签" />
        </div>

        <label class="modal-field-label" for="edit-photo-desc">描述</label>
        <textarea
          id="edit-photo-desc"
          v-model="editDesc"
          class="edit-textarea"
          rows="3"
          placeholder="描述这张照片…"
        ></textarea>

        <div class="modal-actions">
          <button class="btn btn-secondary" type="button" @click="editOpen = false">取消</button>
          <button class="btn btn-primary" type="button" @click="saveEdit">保存</button>
        </div>
      </div>
    </Modal>
  </div>

  <div v-else class="empty-shell">
    <p>照片不存在</p>
    <button class="btn btn-secondary" type="button" @click="goBack">返回图库</button>
  </div>
</template>

<style scoped>
.viewer-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.viewer-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.viewer-nav {
  width: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sidebar);
}
.viewer-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--sidebar);
  padding: 32px;
}
.viewer-meta {
  width: 300px;
  flex-shrink: 0;
  overflow-y: auto;
  background: var(--card);
  border-left: 1px solid var(--border);
  padding: 24px;
}

/* 标题栏 */
.title-bar {
  height: 44px;
  flex-shrink: 0;
  background: var(--sidebar);
  border-bottom: 1px solid var(--sidebar-border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  position: relative;
  gap: 16px;
}
.tl-dots {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}
.tl-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.tl-red {
  background: var(--tl-red);
}
.tl-yellow {
  background: var(--tl-yellow);
}
.tl-green {
  background: var(--tl-green);
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--sidebar-foreground);
  font-size: 13px;
  font-family: var(--font-sans);
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.18s ease, background-color 0.18s ease;
}
.back-link:hover {
  opacity: 0.65;
  background: var(--sidebar-accent);
}
.title-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  color: var(--muted-foreground);
  font-size: 12px;
  font-family: var(--font-mono);
  white-space: nowrap;
}
.title-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
}
.tb-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--sidebar-foreground);
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.18s ease, opacity 0.18s ease;
}
.tb-icon:hover {
  background: var(--sidebar-accent);
}
.tb-icon.fav {
  color: var(--tl-red);
}
.tb-divider {
  width: 1px;
  height: 20px;
  background: var(--sidebar-border);
  flex-shrink: 0;
}

/* 导航圆钮 */
.nav-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  background: var(--secondary);
  color: var(--foreground);
  transition: background-color 0.18s ease;
}
.nav-circle:hover {
  background: var(--sidebar-accent);
}

/* 图片区 */
.viewer-image-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  width: 100%;
}
.viewer-image {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
}
.viewer-counter {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 12px;
  text-align: center;
  font-family: var(--font-mono);
  flex-shrink: 0;
}

/* 元数据面板 */
.meta-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 4px;
}
.meta-date {
  font-size: 13px;
  color: var(--muted-foreground);
  margin: 0 0 24px;
}
.meta-section {
  margin-top: 24px;
}
.meta-section:first-of-type {
  margin-top: 0;
}
.meta-eyebrow {
  color: var(--muted-foreground);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 12px;
  font-weight: 600;
}
.meta-eyebrow-desc {
  margin-bottom: 8px;
}
.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.info-label {
  color: var(--muted-foreground);
}
.info-value {
  color: var(--foreground);
  font-weight: 500;
}
.info-value-mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.meta-desc {
  font-size: 13px;
  color: var(--muted-foreground);
  line-height: 1.55;
  margin: 0;
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
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.edit-textarea:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 1px var(--ring);
}

.empty-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--muted-foreground);
}
</style>
