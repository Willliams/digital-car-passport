<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { db } from '@/db'
import { generateId } from '@/services/crypto'
import BaseDivider from '@/components/BaseDivider.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import StatusStamp from '@/components/StatusStamp.vue'
import type { TaskStatus, Task } from '@/types'

const router = useRouter()
const store = useAppStore()

const title = ref('')
const description = ref('')
const date = ref(new Date().toISOString().slice(0, 10))
const status = ref<TaskStatus>('planned')
const carId = ref('')
const editingId = ref<string | null>(null)

const statuses: { label: string; value: TaskStatus }[] = [
  { label: 'ПЛАНИРУЕТСЯ', value: 'planned' },
  { label: 'В РАБОТЕ', value: 'in_progress' },
  { label: 'ГОТОВО', value: 'done' }
]

const recentTasks = ref<Task[]>([])

const isValid = computed(() => {
  return title.value.trim() !== '' && date.value !== ''
})

const isEditing = computed(() => editingId.value !== null)

function formatDate(d: string): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function editTask(task: Task) {
  editingId.value = task.id
  title.value = task.title
  description.value = task.description
  date.value = task.date
  status.value = task.status
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function cancelEdit() {
  editingId.value = null
  title.value = ''
  description.value = ''
  date.value = new Date().toISOString().slice(0, 10)
  status.value = 'planned'
}

async function saveTask() {
  if (!isValid.value || !carId.value) return

  if (editingId.value) {
    await db.tasks.update(editingId.value, {
      title: title.value,
      description: description.value,
      date: date.value,
      status: status.value
    })
  } else {
    await db.tasks.add({
      id: generateId(),
      carId: carId.value,
      title: title.value,
      description: description.value,
      date: date.value,
      status: status.value,
      createdAt: new Date().toISOString()
    })
  }

  cancelEdit()
  await loadTasks()
}

async function changeStatus(task: Task, newStatus: TaskStatus) {
  await db.tasks.update(task.id, { status: newStatus })
  await loadTasks()
}

async function deleteTask(id: string) {
  await db.tasks.delete(id)
  if (editingId.value === id) cancelEdit()
  await loadTasks()
}

async function loadTasks() {
  if (carId.value) {
    recentTasks.value = await db.tasks
      .where('carId')
      .equals(carId.value)
      .reverse()
      .sortBy('date')
  }
}

onMounted(async () => {
  if (!store.ownerId) {
    router.push('/create')
    return
  }

  const cars = await db.cars.where('ownerId').equals(store.ownerId).toArray()
  if (cars.length) {
    carId.value = cars[0].id
    await loadTasks()
  }
})
</script>

<template>
  <div>
    <!-- Back button -->
    <button
      class="mb-4 text-sm flex items-center gap-1"
      style="color: #4A6FA5"
      @click="router.push('/')"
    >
      &larr; НАЗАД
    </button>

    <!-- Header -->
    <div class="text-center mb-2">
      <div class="flex items-center justify-center gap-2 mb-2">
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <h1 class="text-xl font-bold tracking-wider" style="text-transform: uppercase">
          {{ isEditing ? 'РЕДАКТИРОВАТЬ ЗАДАНИЕ' : 'СОЗДАТЬ ЗАДАНИЕ' }}
        </h1>
      </div>
    </div>

    <BaseDivider />

    <!-- Form -->
    <div class="mb-6">
      <div class="space-y-3">
        <BaseInput
          v-model="title"
          label="Название работы *"
          placeholder="Замена масла, ТО-10000..."
          :required="true"
        />

        <div>
          <label class="block text-xs mb-1" style="color: #666">Описание предполагаемых работ</label>
          <textarea
            v-model="description"
            rows="3"
            placeholder="Подробное описание работ..."
            class="input-field resize-none"
          />
        </div>

        <BaseInput
          v-model="date"
          label="Дата работ"
          type="date"
        />

        <!-- Status selector -->
        <div>
          <label class="block text-xs mb-2" style="color: #666">Статус</label>
          <div class="flex gap-2">
            <button
              v-for="s in statuses"
              :key="s.value"
              class="flex-1 py-3 px-2 text-xs font-bold border transition-all"
              :class="status === s.value
                ? 'bg-[#2A2A2A] text-white border-[#2A2A2A]'
                : 'bg-white text-[#666] border-[#999] hover:border-[#2A2A2A]'"
              @click="status = s.value"
              style="text-transform: uppercase; letter-spacing: 1px"
            >
              {{ s.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <BaseDivider />

    <!-- Buttons -->
    <div class="flex gap-3 mb-6">
      <BaseButton
        :label="isEditing ? 'СОХРАНИТЬ ИЗМЕНЕНИЯ' : 'СОХРАНИТЬ ЗАДАНИЕ'"
        variant="primary"
        :disabled="!isValid"
        @click="saveTask"
      />
      <BaseButton
        v-if="isEditing"
        label="ОТМЕНА"
        variant="secondary"
        @click="cancelEdit"
      />
    </div>

    <BaseDivider />

    <!-- Recent tasks -->
    <div v-if="recentTasks.length" class="mb-6">
      <h2 class="text-sm font-bold mb-3" style="text-transform: uppercase; letter-spacing: 1px">
        ЗАДАНИЯ
      </h2>
      <div class="space-y-3">
        <div
          v-for="task in recentTasks"
          :key="task.id"
          class="py-3 border-b border-dashed"
          style="border-color: #999"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1">
              <div class="font-bold text-sm">{{ task.title }}</div>
              <div v-if="task.description" class="text-xs mt-1" style="color: #666">
                {{ task.description }}
              </div>
              <div class="text-xs mt-1" style="color: #666">
                {{ formatDate(task.date) }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <StatusStamp :status="task.status === 'done' ? 'ready' : task.status === 'in_progress' ? 'in_progress' : 'paid'" size="sm" />
            </div>
          </div>
          <!-- Actions -->
          <div class="flex gap-1 mt-2">
            <button
              v-for="s in statuses"
              :key="s.value"
              class="text-[10px] px-2 py-1 border transition-all"
              :class="task.status === s.value
                ? 'bg-[#2A2A2A] text-white border-[#2A2A2A]'
                : 'bg-white border-[#999] hover:border-[#2A2A2A]'"
              style="text-transform: uppercase; letter-spacing: 0.5px"
              @click="changeStatus(task, s.value)"
            >
              {{ s.label }}
            </button>
            <button
              class="text-[10px] px-2 py-1 border border-dashed hover:bg-[#F1F5F9] transition-colors ml-auto"
              style="border-color: #999; color: #666"
              @click="editTask(task)"
            >
              РЕДАКТ.
            </button>
            <button
              class="text-[10px] px-2 py-1 border border-dashed hover:bg-red-50 transition-colors"
              style="border-color: #999; color: #B91C1C"
              @click="deleteTask(task.id)"
            >
              УДАЛ.
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="text-center text-xs" style="color: #999">
      Данные зашифрованы
    </div>
  </div>
</template>
