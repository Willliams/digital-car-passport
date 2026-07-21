<script setup lang="ts">
interface Props {
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  disabled?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false
})

const emit = defineEmits<{ click: [e: MouseEvent] }>()

const sizeClass = {
  sm: 'btn--sm',
  md: '',
  lg: ''
}[props.size]
</script>

<template>
  <button
    :class="['btn', `btn--${variant}`, sizeClass]"
    :disabled="disabled || loading"
    @click="emit('click', $event)"
  >
    <span v-if="loading" class="animate-pulse">...</span>
    <span v-else-if="icon">{{ icon }}</span>
    <span>{{ label }}</span>
  </button>
</template>
