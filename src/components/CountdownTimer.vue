<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Props {
  expiresAt: number
  onExpire?: () => void
}

const props = defineProps<Props>()

const emit = defineEmits<{ expire: [] }>()

const now = ref(Date.now())
let interval: ReturnType<typeof setInterval>

const remaining = computed(() => {
  const diff = props.expiresAt - now.value
  if (diff <= 0) return 0
  return diff
})

const formatted = computed(() => {
  const totalSeconds = Math.floor(remaining.value / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const progress = computed(() => {
  const total = props.expiresAt - (props.expiresAt - 3600000)
  const elapsed = total - remaining.value
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
})

const isExpired = computed(() => remaining.value <= 0)

onMounted(() => {
  interval = setInterval(() => {
    now.value = Date.now()
    if (remaining.value <= 0) {
      clearInterval(interval)
      emit('expire')
    }
  }, 1000)
})

onUnmounted(() => {
  clearInterval(interval)
})
</script>

<template>
  <div>
    <div v-if="!isExpired" class="text-center">
      <div class="text-2xl font-bold tracking-wider mb-2" style="font-variant-numeric: tabular-nums">
        {{ formatted }}
      </div>
      <div class="progress-bar">
        <div class="progress-bar__fill" :style="{ width: progress + '%' }" />
      </div>
    </div>
    <div v-else class="text-center text-gray-400 text-lg">
      СРОК ИСТЁК
    </div>
  </div>
</template>
