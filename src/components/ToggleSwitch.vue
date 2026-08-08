<script setup lang="ts">
defineProps<{ modelValue: boolean; label: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();
</script>

<template>
  <button
    class="toggle"
    :class="modelValue ? 'on' : 'off'"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    type="button"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="toggle-knob"></span>
  </button>
</template>
