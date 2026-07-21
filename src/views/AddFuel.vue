<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { db } from '@/db'
import { generateId } from '@/services/crypto'
import BaseDivider from '@/components/BaseDivider.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import type { FuelRecord } from '@/types'

const router = useRouter()
const store = useAppStore()

const liters = ref<number | null>(null)
const odometer = ref<number | null>(null)
const lastFuel = ref<FuelRecord | null>(null)
const carId = ref('')
const currentMileage = ref(0)

const distance = computed(() => {
  if (!lastFuel.value || !odometer.value) return null
  return odometer.value - lastFuel.value.mileage
})

const consumption = computed(() => {
  if (!distance.value || !liters.value || distance.value <= 0) return null
  return ((liters.value / distance.value) * 100).toFixed(1)
})

const fuelStats = computed(() => {
  if (!lastFuel.value || !distance.value) return null
  return {
    distance: distance.value,
    consumption: consumption.value ? parseFloat(consumption.value) : null,
    liters: liters.value || 0,
    lastMileage: lastFuel.value.mileage,
    currentOdometer: odometer.value || 0
  }
})

function formatDate(d: string): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMileage(m: number): string {
  return new Intl.NumberFormat('ru-RU').format(m)
}

async function save() {
  if (!carId.value || !liters.value || !odometer.value) return

  const consumptionValue = consumption.value ? parseFloat(consumption.value) : null

  await db.fuel.add({
    id: generateId(),
    carId: carId.value,
    date: new Date().toISOString().slice(0, 10),
    liters: liters.value,
    mileage: odometer.value,
    consumption: consumptionValue
  })

  // Update car mileage if odometer is higher
  if (odometer.value > currentMileage.value) {
    await db.cars.update(carId.value, { currentMileage: odometer.value })
    currentMileage.value = odometer.value
  }

  // Reset form
  liters.value = null
  odometer.value = null

  // Reload last fuel
  const fuels = await db.fuel
    .where('carId')
    .equals(carId.value)
    .reverse()
    .sortBy('date')
  if (fuels.length) {
    lastFuel.value = fuels[0]
  }

  router.push('/')
}

function goBack() {
  router.push('/')
}

function goToHistory() {
  router.push('/history')
}

onMounted(async () => {
  if (!store.ownerId) {
    router.push('/create')
    return
  }

  const cars = await db.cars.where('ownerId').equals(store.ownerId).toArray()
  if (cars.length) {
    carId.value = cars[0].id
    currentMileage.value = cars[0].currentMileage

    const fuels = await db.fuel
      .where('carId')
      .equals(carId.value)
      .reverse()
      .sortBy('date')

    if (fuels.length) {
      lastFuel.value = fuels[0]
    }
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
          <path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/>
          <path d="M15 10h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2v0a2 2 0 0 0 2-2V9l-3-3"/>
          <path d="M3 22h12"/>
          <rect x="6" y="7" width="6" height="4" rx="1"/>
        </svg>
        <h1 class="text-xl font-bold tracking-wider" style="text-transform: uppercase">
          ДОБАВИТЬ ЗАПРАВКУ
        </h1>
      </div>
      <p class="text-xs" style="color: #666">
        Запись о заправке помогает отслеживать реальный пробег и расход топлива
      </p>
    </div>

    <BaseDivider />

    <!-- Current mileage -->
    <div class="mb-4 text-sm">
      <div style="color: #666">Текущий пробег:</div>
      <div class="font-bold text-lg">{{ formatMileage(currentMileage) }} км</div>
    </div>

    <BaseDivider />

    <!-- Last fuel info -->
    <div v-if="lastFuel" class="mb-6">
      <h2 class="text-sm font-bold mb-2" style="text-transform: uppercase; letter-spacing: 1px">
        ПОСЛЕДНЯЯ ЗАПРАВКА
      </h2>
      <div class="text-sm" style="color: #666">
        <div>{{ formatDate(lastFuel.date) }}</div>
        <div>{{ lastFuel.liters }} л • Пробег на одометре: {{ formatMileage(lastFuel.mileage) }} км</div>
        <div v-if="lastFuel.consumption">Расход: {{ lastFuel.consumption }} л/100км</div>
      </div>
    </div>

    <BaseDivider v-if="lastFuel" />

    <!-- Input fields -->
    <div class="mb-6">
      <div class="flex items-end gap-4">
        <div class="flex-1">
          <BaseInput
            v-model="liters"
            label="Литры *"
            type="number"
            placeholder="0.0"
            :step="0.1"
            :min="0"
          />
        </div>
        <div class="flex-1">
          <BaseInput
            v-model="odometer"
            label="Пробег на одометре *"
            type="number"
            placeholder="0"
            :min="currentMileage"
          />
        </div>
      </div>
    </div>

    <BaseDivider />

    <!-- Auto calculation -->
    <div class="mb-6">
      <h2 class="text-sm font-bold mb-2" style="text-transform: uppercase; letter-spacing: 1px">
        АНАЛИЗ РАСХОДА
      </h2>
      <div class="space-y-1 text-sm" style="color: #666">
        <div>
          Пройдено: <span class="font-bold" style="color: #2A2A2A">
            {{ distance !== null ? formatMileage(distance) + ' км' : '—' }}
          </span>
        </div>
        <div>
          Расход топлива: <span class="font-bold" style="color: #2A2A2A">
            {{ consumption !== null ? consumption + ' л/100км' : '—' }}
          </span>
        </div>
        <div v-if="consumption" class="mt-2 p-3" style="background: #F1F5F9">
          <div class="text-xs" style="color: #666">
            Формула: ({{ liters }} л / {{ distance }} км) × 100 = {{ consumption }} л/100км
          </div>
        </div>
      </div>
    </div>

    <BaseDivider />

    <!-- Actions -->
    <div class="flex gap-3 mb-6">
      <BaseButton
        label="СОХРАНИТЬ"
        variant="primary"
        :disabled="!liters || !odometer || odometer < currentMileage"
        @click="save"
      />
      <BaseButton
        label="ОТМЕНА"
        variant="secondary"
        @click="goBack"
      />
      <BaseButton
        label="ИСТОРИЯ"
        variant="secondary"
        @click="goToHistory"
      />
    </div>

    <!-- Footer -->
    <div class="text-center text-xs" style="color: #999">
      Данные зашифрованы
    </div>
  </div>
</template>
