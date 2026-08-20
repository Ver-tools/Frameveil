<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Check } from 'lucide-vue-next';
import type { Photo } from '../types';
import PhotoCard from './PhotoCard.vue';
import ThumbImg from './ThumbImg.vue';
import { openViewer, selection, toggleSelect } from '../store/library';
import { formatBytes, formatTimestamp } from '../utils/format';

const props = defineProps<{
  photos: Photo[];
  /** grid 网格 / list 列表 */
  view: 'grid' | 'list';
  /** 当前来源页面标题与路由（用于查看器返回） */
  context?: { label: string; route: string };
  albumId?: string;
}>();

const router = useRouter();

function open(photo: Photo, index: number) {
  openViewer(props.photos, index, props.albumId, props.context);
  router.push({ path: `/viewer/${photo.id}` });
}

/** 选择模式下点击切换选择，否则打开查看器 */
function onCardClick(photo: Photo, index: number) {
  if (selection.active) toggleSelect(photo.id);
  else open(photo, index);
}

/* ── 行级虚拟滚动 ────────────────────────────────────────
 * 网格按行占位（行高 = 单元宽 × 4/3，与 portrait 卡片一致），
 * 仅渲染视口 ± overscan 内的行；滚动容器为最近的滚动祖先。
 * ──────────────────────────────────────────────────────── */
const GAP = 16;
const MIN_CELL = 200;
const OVERSCAN = 900;

const gridEl = ref<HTMLElement | null>(null);
const listEl = ref<HTMLElement | null>(null);
const cols = ref(1);
const cellWidth = ref(MIN_CELL);
/** 可见（含预渲染）行索引集合 */
const visibleRows = reactive(new Set<number>());

/** 照片按列数切分成行 */
const gridRows = computed<Photo[][]>(() => {
  const n = Math.max(1, cols.value);
  const rows: Photo[][] = [];
  for (let i = 0; i < props.photos.length; i += n) {
    rows.push(props.photos.slice(i, i + n));
  }
  return rows;
});

/** 网格行高：portrait 卡片（3/4 比例）为行内最高，与原 stretch 布局一致 */
const gridRowH = computed(() => Math.round((cellWidth.value * 4) / 3));

let io: IntersectionObserver | null = null;
let ro: ResizeObserver | null = null;

/** 向上查找最近的可滚动祖先（.app-content） */
function findScrollRoot(el: Element | null): Element | null {
  let node = el;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(style.overflowY)) return node;
    node = node.parentElement;
  }
  return null;
}

/** 重新观察当前视图的全部行元素（photos / cols / 视图切换后调用） */
function observeRows() {
  if (!io) return;
  io.disconnect();
  visibleRows.clear();
  const root = props.view === 'grid' ? gridEl.value : listEl.value;
  if (!root) return;
  const rows = Array.from(root.children) as HTMLElement[];
  // 首屏先渲染前两行，避免 IO 首次回调前空白
  for (let i = 0; i < Math.min(2, rows.length); i++) visibleRows.add(i);
  for (const el of rows) io.observe(el);
}

function measureGrid() {
  const el = gridEl.value;
  if (!el) return;
  const w = el.clientWidth;
  const n = Math.max(1, Math.floor((w + GAP) / (MIN_CELL + GAP)));
  cols.value = n;
  cellWidth.value = (w - (n - 1) * GAP) / n;
}

onMounted(() => {
  const root = findScrollRoot(gridEl.value ?? listEl.value);
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const i = Number((e.target as HTMLElement).dataset.i);
        if (Number.isNaN(i)) continue;
        if (e.isIntersecting) visibleRows.add(i);
        else visibleRows.delete(i);
      }
    },
    { root, rootMargin: `${OVERSCAN}px 0px` }
  );
  ro = new ResizeObserver(() => measureGrid());
  if (gridEl.value) ro.observe(gridEl.value);
  measureGrid();
  observeRows();
});

watch([() => props.photos, () => props.view, cols], () => nextTick(observeRows));

onBeforeUnmount(() => {
  io?.disconnect();
  ro?.disconnect();
});
</script>

<template>
  <!-- 网格视图：行级虚拟滚动 -->
  <div v-if="view === 'grid'" ref="gridEl" class="photo-grid">
    <div
      v-for="(row, r) in gridRows"
      :key="r"
      :data-i="r"
      class="grid-row"
      :style="{ height: `${gridRowH}px`, gridTemplateColumns: `repeat(${cols}, 1fr)` }"
    >
      <template v-if="visibleRows.has(r)">
        <div
          v-for="(p, c) in row"
          :key="p.id"
          class="grid-cell"
          @click="onCardClick(p, r * cols + c)"
        >
          <PhotoCard
            :photo="p"
            :selectable="selection.active"
            :selected="selection.active && selection.ids.has(p.id)"
            @toggle-select="toggleSelect(p.id)"
          />
        </div>
      </template>
      <template v-else>
        <div v-for="p in row" :key="p.id" class="grid-cell ph-cell"></div>
      </template>
    </div>
  </div>

  <!-- 列表视图：行级虚拟滚动 -->
  <div v-else ref="listEl" class="photo-list">
    <div
      v-for="(p, i) in photos"
      :key="p.id"
      :data-i="i"
      class="list-row"
      :class="{ 'list-ph': !visibleRows.has(i) }"
      @click="visibleRows.has(i) && onCardClick(p, i)"
    >
      <template v-if="visibleRows.has(i)">
        <span v-if="selection.active" class="list-check" :class="{ checked: selection.ids.has(p.id) }">
          <Check v-if="selection.ids.has(p.id)" :size="12" stroke-width="3.5" />
        </span>
        <ThumbImg
          class="list-thumb"
          :path="p.builtin ? undefined : p.path"
          :fallback="p.src"
          :alt="p.name"
        />
        <div class="list-main">
          <span class="list-name">{{ p.name }}</span>
          <span class="list-meta">{{ formatTimestamp(p.importedAt) }} · {{ p.format }}</span>
        </div>
        <span v-if="p.isFavorite" class="list-fav">♥</span>
        <span class="list-size">{{ formatBytes(p.size) }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.photo-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.grid-row {
  display: grid;
  gap: 16px;
}
.grid-cell {
  cursor: pointer;
}
.ph-cell {
  background: var(--secondary);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 4px);
}

/* 列表视图 */
.photo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.list-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 12px;
  height: 62px;
  box-sizing: border-box;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 4px);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.list-row:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}
.list-ph {
  cursor: default;
}
.list-ph:hover {
  border-color: var(--border);
  box-shadow: none;
}
.list-thumb {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}
.list-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.list-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.list-meta {
  font-size: 12px;
  color: var(--muted-foreground);
}
.list-fav {
  color: var(--tl-red);
  font-size: 13px;
}
.list-size {
  font-size: 12px;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* 列表视图选择勾选 */
.list-check {
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
.list-check.checked {
  background: var(--primary);
  border-color: var(--primary);
}
</style>
