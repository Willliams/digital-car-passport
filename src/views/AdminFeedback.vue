<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const feedbacks = ref<{text: string; date: string; user: string}[]>([])

onMounted(() => {
  const data = localStorage.getItem('garage_feedback')
  if (data) {
    feedbacks.value = JSON.parse(data)
  }
})

function clearFeedbacks() {
  feedbacks.value = []
  localStorage.removeItem('garage_feedback')
}

function goBack() {
  router.push('/')
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('ru-RU')
}
</script>

<template>
  <div>
    <button class="mb-4 text-sm flex items-center gap-1" style="color: #4A6FA5" @click="goBack">
      &larr; НАЗАД
    </button>

    <h1 class="text-xl font-bold mb-4" style="text-transform: uppercase; letter-spacing: 1px">
      ОБРАТНАЯ СВЯЗЬ
    </h1>

    <div class="divider my-4"></div>

    <div v-if="!feedbacks.length" class="text-center py-8 text-sm" style="color: #666">
      Нет отзывов
    </div>

    <div v-else class="space-y-3">
      <div v-for="(f, i) in feedbacks" :key="i" class="p-3" style="border: 1px dashed #999">
        <div class="text-[10px] mb-1" style="color: #999">
          {{ formatDate(f.date) }} | {{ f.user || 'Аноним' }}
        </div>
        <div class="text-sm" style="color: #2A2A2A">{{ f.text }}</div>
      </div>
    </div>

    <div v-if="feedbacks.length" class="mt-4">
      <button class="w-full py-2 text-[10px] border border-dashed"
        style="border-color: #999; color: #B91C1C; text-transform: uppercase"
        @click="clearFeedbacks">
        ОЧИСТИТЬ ВСЕ
      </button>
    </div>

    <div class="text-center mt-4 text-[10px]" style="color: #999">
      Всего: {{ feedbacks.length }} отзывов
    </div>
  </div>
</template>
