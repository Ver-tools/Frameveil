<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { ChevronDown, Check } from 'lucide-vue-next';

defineProps<{
  modelValue: string;
  options: { label: string; value: string }[];
  /** 无障碍标签 */
  ariaLabel?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}

function pick(v: string) {
  emit('update:modelValue', v);
  open.value = false;
}

function onDocClick(e: MouseEvent) {
  if (!open.value) return;
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false;
}

onMounted(() => {
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKeydown);
});
onUnmounted(() => {
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="root" class="dropdown">
    <button
      class="dropdown-trigger"
      type="button"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="dropdown-value">{{ options.find((o) => o.value === modelValue)?.label ?? modelValue }}</span>
      <ChevronDown :size="16" class="dropdown-caret" :class="{ open }" />
    </button>
    <transition name="dropdown">
      <ul v-if="open" class="dropdown-menu" role="listbox">
        <li v-for="opt in options" :key="opt.value" role="option" :aria-selected="opt.value === modelValue">
          <button
            class="dropdown-item"
            :class="{ active: opt.value === modelValue }"
            type="button"
            @click="pick(opt.value)"
          >
            <span>{{ opt.label }}</span>
            <Check v-if="opt.value === modelValue" :size="14" />
          </button>
        </li>
      </ul>
    </transition>
  </div>
</template>

<style scoped>
.dropdown {
  position: relative;
  display: inline-flex;
}
.dropdown-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  padding: 0;
  transition: color 0.18s ease;
}
.dropdown-trigger:hover {
  color: var(--foreground);
}
.dropdown-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dropdown-caret {
  flex-shrink: 0;
  transition: transform 0.18s ease;
}
.dropdown-caret.open {
  transform: rotate(180deg);
}
.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 50;
  min-width: max-content;
  max-width: 240px;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--popover);
  color: var(--popover-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
}
.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--popover-foreground);
  font-size: 13px;
  font-family: var(--font-sans);
  text-align: left;
  padding: 8px 10px;
  border-radius: calc(var(--radius) - 4px);
  cursor: pointer;
  transition: background-color 0.18s ease;
}
.dropdown-item:hover {
  background: var(--accent);
}
.dropdown-item.active {
  color: var(--primary);
  font-weight: 600;
}

/* 过渡动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
