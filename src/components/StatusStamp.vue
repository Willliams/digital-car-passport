<script setup lang="ts">
import type { StampStatus, StampSize } from '@/types'

interface Props {
  status: StampStatus
  size?: StampSize
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md'
})

const statusLabels: Record<StampStatus, string> = {
  in_progress: 'В РАБОТЕ',
  ready: 'ГОТОВА',
  paid: 'ОПЛАЧЕНА'
}
</script>

<template>
  <span
    :class="['stamp', `stamp--${status}`, size === 'lg' ? 'stamp--lg' : '']"
  >
    {{ statusLabels[status] }}
  </span>
</template>
