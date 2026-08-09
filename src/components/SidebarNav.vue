<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { House, Clock, Heart, Tag, Trash2, User, Upload } from 'lucide-vue-next';
import { library } from '../store/library';

const route = useRoute();

const navGroups = [
  {
    label: '图库',
    items: [
      { name: '图库', to: '/', icon: House },
      { name: '最近', to: '/recent', icon: Clock },
      { name: '收藏', to: '/favorites', icon: Heart },
    ],
  },
  {
    label: '管理',
    items: [
      { name: '导入', to: '/import', icon: Upload },
      { name: '标签', to: '/tags', icon: Tag },
      { name: '回收站', to: '/trash', icon: Trash2 },
    ],
  },
];

/** 回收站照片数量（用于在侧边栏显示徽标） */
const trashCount = computed(() => library.photos.filter((p) => p.inTrash).length);

function isActive(to: string): boolean {
  if (to === '/') return route.path === '/';
  return route.path.startsWith(to);
}
</script>

<template>
  <div class="sidebar-inner">
    <nav v-for="group in navGroups" :key="group.label" class="nav-section">
      <p class="nav-label">{{ group.label }}</p>
      <RouterLink
        v-for="item in group.items"
        :key="item.name"
        class="nav-item"
        :class="isActive(item.to) ? 'active' : 'inactive'"
        :to="item.to"
      >
        <component :is="item.icon" :size="18" stroke-width="2" class="nav-icon" />
        <span>{{ item.name }}</span>
        <span
          v-if="item.to === '/trash' && trashCount > 0"
          class="nav-badge"
          :class="{ active: isActive(item.to) }"
        >
          {{ trashCount }}
        </span>
      </RouterLink>
    </nav>

    <hr class="nav-divider" />

    <nav class="nav-section">
      <p class="nav-label">系统</p>
      <RouterLink class="nav-item" :class="route.path === '/settings' ? 'active' : 'inactive'" to="/settings">
        <User :size="18" stroke-width="2" class="nav-icon" />
        <span>设置</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.sidebar-inner {
  padding: 16px 12px;
}
.nav-section {
  margin-bottom: 18px;
}
.nav-section:last-of-type {
  margin-bottom: 0;
}
.nav-label {
  color: var(--muted-foreground);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 8px;
  padding: 0 12px;
  font-weight: 600;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--sidebar-foreground);
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.18s ease, opacity 0.18s ease;
}
.nav-item > span:first-of-type {
  flex: 1;
  min-width: 0;
}
.nav-item:hover {
  background: var(--sidebar-accent);
}
.nav-icon {
  flex-shrink: 0;
  color: inherit;
}
.nav-item.inactive {
  opacity: 0.6;
}
.nav-item.inactive:hover {
  opacity: 1;
}
.nav-item.active {
  background: var(--sidebar-accent);
  font-weight: 600;
  cursor: default;
}
.nav-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--state-error-surface);
  color: var(--destructive);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.nav-badge.active {
  background: var(--destructive);
  color: var(--destructive-foreground);
}
.nav-divider {
  border: 0;
  border-top: 1px solid var(--sidebar-border);
  margin: 12px 0;
}
</style>
