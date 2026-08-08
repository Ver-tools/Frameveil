<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { CirclePlus, Grip, List } from 'lucide-vue-next';
import AppShell from '../components/AppShell.vue';
import { albumsWithCounts, library } from '../store/library';

const router = useRouter();

const searchQuery = ref('');
const activeFilter = ref('全部');
const view = ref<'grid' | 'list'>(library.settings.defaultView);

const filters = ['全部', '人物', '风景', '街拍', '黑白'];

const filteredAlbums = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return albumsWithCounts.value.filter((a) => {
    const matchFilter = activeFilter.value === '全部' || a.category === activeFilter.value;
    const matchSearch = !q || a.name.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });
});

const totalPhotos = computed(() =>
  albumsWithCounts.value.reduce((sum, a) => sum + a.photoCount, 0)
);

function setView(v: 'grid' | 'list') {
  view.value = v;
  library.settings.defaultView = v;
}

function openAlbum(id: string) {
  router.push(`/album/${id}`);
}
</script>

<template>
  <AppShell
    title="Frameveil"
    :show-search="true"
    @search="searchQuery = $event"
  >
    <div class="page">
      <div class="content-header">
        <div>
          <h1 class="page-title">我的图库</h1>
          <p class="subtitle">共 {{ albumsWithCounts.length }} 个写真集 · {{ totalPhotos }} 张照片</p>
        </div>
        <button class="import-btn" type="button" @click="router.push('/import')">
          <CirclePlus :size="16" />
          <span>导入</span>
        </button>
      </div>

      <div class="filter-bar">
        <button
          v-for="f in filters"
          :key="f"
          class="filter-chip"
          :class="activeFilter === f ? 'active' : 'inactive'"
          type="button"
          @click="activeFilter = f"
        >
          {{ f }}
        </button>
        <div class="view-toggle">
          <button
            type="button"
            :class="{ active: view === 'grid' }"
            aria-label="网格视图"
            title="网格视图"
            @click="setView('grid')"
          >
            <Grip :size="18" />
          </button>
          <button
            type="button"
            :class="{ active: view === 'list' }"
            aria-label="列表视图"
            title="列表视图"
            @click="setView('list')"
          >
            <List :size="18" />
          </button>
        </div>
      </div>

      <div v-if="view === 'grid'" class="collection-grid">
        <article
          v-for="album in filteredAlbums"
          :key="album.id"
          class="collection-card"
          style="cursor: pointer"
          @click="openAlbum(album.id)"
        >
          <img class="cover" :src="album.coverSrc" :alt="album.name" loading="lazy" />
          <div class="card-body">
            <h3 class="collection-title">{{ album.name }}</h3>
            <p class="collection-meta">{{ album.photoCount }}张 · {{ album.period }}</p>
          </div>
        </article>
      </div>

      <div v-else class="album-list">
        <div
          v-for="album in filteredAlbums"
          :key="album.id"
          class="album-row"
          @click="openAlbum(album.id)"
        >
          <img class="album-thumb" :src="album.coverSrc" :alt="album.name" loading="lazy" />
          <div class="album-info">
            <span class="album-name">{{ album.name }}</span>
            <span class="album-desc">{{ album.description }}</span>
          </div>
          <span class="album-category">{{ album.category }}</span>
          <span class="album-count">{{ album.photoCount }} 张照片</span>
        </div>
      </div>

      <div v-if="!filteredAlbums.length" class="empty-state">
        <p class="empty-desc">没有找到匹配的写真集</p>
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
.import-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 999px;
  background: var(--primary);
  color: var(--primary-foreground);
  font: 600 13px/1 var(--font-sans);
  cursor: pointer;
  transition: filter 0.18s ease;
}
.import-btn:hover {
  filter: brightness(0.96);
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.view-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.view-toggle button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}
.view-toggle button.active {
  background: var(--secondary);
  color: var(--foreground);
}
.view-toggle button:hover {
  background: var(--accent);
}
.view-toggle button.active:hover {
  background: var(--secondary);
}

/* 网格视图 */
.collection-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
.collection-card {
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease;
}
.collection-card .cover {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
  border-radius: calc(var(--radius) - 4px);
  border: 1px solid var(--border);
  transition: border-color 0.2s ease;
}
.collection-card .card-body {
  padding: 12px 4px;
}
.collection-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--foreground);
}
.collection-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted-foreground);
}
.collection-card:hover {
  transform: translateY(-2px);
}
.collection-card:hover .cover {
  border-color: var(--primary);
}

/* 列表视图 */
.album-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.album-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.album-row:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
.album-thumb {
  width: 88px;
  height: 66px;
  object-fit: cover;
  border-radius: calc(var(--radius) - 6px);
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.album-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.album-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--foreground);
}
.album-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.album-category {
  font-size: 12px;
  color: var(--muted-foreground);
  flex-shrink: 0;
}
.album-count {
  font-size: 13px;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
</style>
