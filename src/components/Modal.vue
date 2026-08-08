<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<template>
  <Teleport to="body">
    <div class="modal-mask" @click.self="emit('close')">
      <div class="modal-panel" role="dialog" aria-modal="true">
        <h2 v-if="title" class="modal-title">{{ title }}</h2>
        <p v-if="subtitle" class="modal-subtitle">{{ subtitle }}</p>
        <slot></slot>
      </div>
    </div>
  </Teleport>
</template>
