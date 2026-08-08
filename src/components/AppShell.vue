<script setup lang="ts">
import SidebarNav from './SidebarNav.vue';

const props = withDefaults(
  defineProps<{
    /** 是否显示侧边栏 */
    withSidebar?: boolean;
  }>(),
  { withSidebar: true }
);
</script>

<template>
  <div class="app-shell">
    <div class="app-body">
      <aside v-if="props.withSidebar" class="app-sidebar no-scrollbar">
        <SidebarNav />
      </aside>
      <section class="app-content">
        <slot></slot>
      </section>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.app-sidebar {
  width: 220px;
  flex-shrink: 0;
  overflow-y: auto;
  background: var(--sidebar);
  border-right: 1px solid var(--sidebar-border);
}
.app-content {
  flex: 1;
  overflow-y: auto;
  background: var(--background);
}
</style>
