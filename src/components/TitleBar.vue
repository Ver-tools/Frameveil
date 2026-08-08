<script setup lang="ts">
import { Search, ArrowLeft } from 'lucide-vue-next';

defineProps<{
  /** 标题栏中央标题 */
  title: string;
  /** 返回链接（显示在左侧） */
  back?: { label: string; to: string } | null;
  /** 是否显示搜索框（图库页） */
  showSearch?: boolean;
}>();

const emit = defineEmits<{ (e: 'search', value: string): void }>();
</script>

<template>
  <header class="title-bar">
    <div class="tl-group" aria-hidden="true">
      <span class="tl-dot tl-red"></span>
      <span class="tl-dot tl-yellow"></span>
      <span class="tl-dot tl-green"></span>
    </div>

    <RouterLink v-if="back" class="back-link" :to="back.to">
      <ArrowLeft :size="16" stroke-width="2" />
      <span>{{ back.label }}</span>
    </RouterLink>

    <span class="title-center">{{ title }}</span>

    <div class="title-right">
      <label v-if="showSearch" class="search-field">
        <Search :size="14" style="color: var(--muted-foreground); flex-shrink: 0" />
        <input
          type="text"
          placeholder="搜索写真集"
          aria-label="搜索写真集"
          @input="emit('search', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <slot name="right"></slot>
    </div>
  </header>
</template>

<style scoped>
.title-bar {
  position: relative;
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 16px;
  background: var(--sidebar);
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
  gap: 16px;
}
.tl-group {
  display: flex;
  align-items: center;
  gap: 8px;
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
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--sidebar-foreground);
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.18s ease;
}
.back-link:hover {
  background: var(--sidebar-accent);
}
.title-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  color: var(--sidebar-foreground);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.title-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
}
.search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 280px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  background: var(--background);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.search-field:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent);
}
.search-field input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--foreground);
  font: 500 13px/1 var(--font-sans);
}
.search-field input::placeholder {
  color: var(--muted-foreground);
}
</style>
