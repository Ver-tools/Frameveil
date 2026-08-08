<script setup lang="ts">
import { watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { library, setSelectMode } from './store/library';

const route = useRoute();

/** 应用主题：浅色 / 深色 / 自动 */
function applyTheme(theme: string) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'auto' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('light', !dark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

watch(
  () => library.settings.theme,
  (t) => applyTheme(t),
  { immediate: true }
);

/** 路由切换时退出照片选择模式 */
watch(
  () => route.path,
  () => setSelectMode(false)
);

onMounted(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => applyTheme(library.settings.theme);
  mq.addEventListener('change', handler);
  // 跟随系统时同步初始状态
  applyTheme(library.settings.theme);

  // Esc 退出照片选择模式
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setSelectMode(false);
  });
});
</script>

<template>
  <div class="app-root">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>

    <div class="toast-wrap">
      <transition-group name="fade">
        <div v-for="t in library.toasts" :key="t.id" class="toast-item" :class="`toast-${t.kind}`">
          {{ t.message }}
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style scoped>
.app-root {
  height: 100vh;
  overflow: hidden;
}
</style>
