<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { db } from '@/db'
import { decrypt } from '@/services/crypto'
import BaseDivider from '@/components/BaseDivider.vue'
import BaseButton from '@/components/BaseButton.vue'
import StatusStamp from '@/components/StatusStamp.vue'
import type { Car, Owner, ServiceRecord } from '@/types'

const router = useRouter()
const store = useAppStore()

const owner = ref<Owner | null>(null)
const car = ref<Car | null>(null)
const service = ref<ServiceRecord | null>(null)
const decryptedPhone = ref('')
const decryptedPlate = ref('')

const carTitle = computed(() => {
  if (!car.value) return ''
  return `${car.value.brand} ${car.value.model} ${car.value.year || ''}`
})

const totalParts = computed(() => {
  if (!service.value) return 0
  return service.value.parts.reduce((sum: number, p) => sum + p.price * p.quantity, 0)
})

const grandTotal = computed(() => {
  if (!service.value) return 0
  const worksTotal = service.value.works.reduce((sum: number, w) => sum + w.price, 0)
  return worksTotal + totalParts.value
})

function formatPrice(p: number): string {
  return new Intl.NumberFormat('ru-RU').format(p) + ' ₽'
}

onMounted(async () => {
  if (!store.ownerId || !store.masterKey) {
    router.push('/create')
    return
  }

  owner.value = await db.owners.get(store.ownerId) || null
  if (!owner.value) {
    router.push('/create')
    return
  }

  const cars = await db.cars.where('ownerId').equals(store.ownerId).toArray()
  car.value = cars[0] || null

  if (car.value) {
    decryptedPhone.value = await decrypt(owner.value.phone, store.masterKey)
    decryptedPlate.value = await decrypt(car.value.plate, store.masterKey)

    // Get latest service record
    const services = await db.services
      .where('carId')
      .equals(car.value.id)
      .reverse()
      .sortBy('date')

    service.value = services[0] || null
  }
})
</script>

<template>
  <div v-if="car && owner">
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
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10,9 9,9 8,9"/>
        </svg>
        <h1 class="text-xl font-bold tracking-wider" style="text-transform: uppercase">
          ПЛАН РАБОТ
        </h1>
      </div>
    </div>

    <BaseDivider />

    <!-- Car info -->
    <div class="mb-4 text-sm">
      <div class="font-bold">{{ carTitle }}</div>
      <div style="color: #666">
        <span v-if="car.vin">VIN: <span class="font-mono">{{ car.vin }}</span></span>
        <span v-if="decryptedPlate"> • Номер: <span class="font-mono uppercase">{{ decryptedPlate }}</span></span>
      </div>
    </div>

    <!-- Client info -->
    <div class="mb-4 text-sm">
      <div>Владелец: {{ owner.name }}</div>
      <div style="color: #666">Телефон: {{ decryptedPhone }}</div>
    </div>

    <BaseDivider />

    <!-- Status stamp -->
    <div class="flex justify-center my-8">
      <StatusStamp
        :status="service?.status || 'in_progress'"
        size="lg"
      />
    </div>

    <BaseDivider />

    <!-- Client complaint -->
    <div v-if="service" class="mb-6">
      <h2 class="text-sm font-bold mb-2" style="text-transform: uppercase; letter-spacing: 1px">
        ЖАЛОБА КЛИЕНТА:
      </h2>
      <p class="text-sm" style="color: #666; line-height: 1.5">
        {{ service.serviceName }}
      </p>
    </div>

    <!-- Works -->
    <div v-if="service?.works.length" class="mb-6">
      <h2 class="text-sm font-bold mb-2" style="text-transform: uppercase; letter-spacing: 1px">
        ПРЕДЛАГАЕМЫЕ РАБОТЫ:
      </h2>
      <div class="space-y-1">
        <div
          v-for="(work, i) in service.works"
          :key="i"
          class="flex justify-between text-sm"
        >
          <span>{{ i + 1 }}. {{ work.name }}</span>
          <span class="font-bold">{{ formatPrice(work.price) }}</span>
        </div>
      </div>
    </div>

    <!-- Parts -->
    <div v-if="service?.parts.length" class="mb-6">
      <h2 class="text-sm font-bold mb-2" style="text-transform: uppercase; letter-spacing: 1px">
        ЗАПЧАСТИ:
      </h2>
      <div class="space-y-1">
        <div
          v-for="(part, i) in service.parts"
          :key="i"
          class="flex justify-between text-sm"
        >
          <span>{{ part.name }} ({{ part.quantity }})</span>
          <span class="font-bold">{{ formatPrice(part.price * part.quantity) }}</span>
        </div>
      </div>
    </div>

    <BaseDivider v-if="service" />

    <!-- Total -->
    <div v-if="service" class="mb-6">
      <div class="flex justify-between text-lg font-bold">
        <span>ИТОГО:</span>
        <span>{{ formatPrice(grandTotal) }}</span>
      </div>
    </div>

    <BaseDivider v-if="service" />

    <!-- Actions -->
    <div class="space-y-3 mb-6" v-if="service">
      <BaseButton
        label="ПРИНЯТЬ В РАБОТУ"
        variant="primary"
      />
      <BaseButton
        label="ИЗМЕНИТЬ"
        variant="secondary"
      />
      <BaseButton
        label="ОТКЛОНИТЬ"
        variant="danger"
      />
    </div>

    <!-- No service -->
    <div v-if="!service" class="text-center py-8">
      <div class="text-sm" style="color: #666">Нет активных заказов-нарядов</div>
    </div>

    <!-- Footer -->
    <div class="text-center text-xs" style="color: #999">
      Данные зашифрованы
    </div>
  </div>
</template>
