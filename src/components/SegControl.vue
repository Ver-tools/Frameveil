<script setup lang="ts">
defineProps<{
  modelValue: string;
  options: { label: string; value: string }[];
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();
</script>

<template>
  <div class="seg-control" role="tablist">
    <button
      v-for="opt in options"
      :key="opt.value"
      class="seg-item"
      :class="{ active: modelValue === opt.value }"
      type="button"
      role="tab"
      :aria-selected="modelValue === opt.value"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
