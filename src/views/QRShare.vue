<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { db } from '@/db'
import { decrypt } from '@/services/crypto'
import BaseDivider from '@/components/BaseDivider.vue'
import BaseButton from '@/components/BaseButton.vue'
import QRCode from '@/components/QRCode.vue'
import CountdownTimer from '@/components/CountdownTimer.vue'
import type { Car } from '@/types'

const router = useRouter()
const store = useAppStore()

const car = ref<Car | null>(null)
const decryptedPlate = ref('')

const selectedDuration = ref(3600) // 1 hour default
const expiresAt = ref(Date.now() + 3600000)
const token = ref('')
const isRevoked = ref(false)

const durations = [
  { label: '30 МИН', value: 1800000 },
  { label: '1 ЧАС', value: 3600000 },
  { label: '2 ЧАСА', value: 7200000 },
  { label: '4 ЧАСА', value: 14400000 },
  { label: 'ДЕНЬ', value: 86400000 }
]

const qrValue = computed(() => {
  if (isRevoked.value || Date.now() > expiresAt.value) return ''
  return `https://crm.app/share?token=${token.value}&expires=${expiresAt.value}`
})

const carTitle = computed(() => {
  if (!car.value) return ''
  return `${car.value.brand} ${car.value.model} ${car.value.year || ''}`
})

function generateToken() {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

function selectDuration(d: { label: string; value: number }) {
  selectedDuration.value = d.value
  expiresAt.value = Date.now() + d.value
  token.value = generateToken()
  isRevoked.value = false
}

function revokeAccess() {
  isRevoked.value = true
  token.value = ''
}

function refreshQR() {
  token.value = generateToken()
  expiresAt.value = Date.now() + selectedDuration.value
  isRevoked.value = false
}

function handleExpire() {
  // QR expired, keep UI as is
}

onMounted(async () => {
  if (!store.ownerId || !store.masterKey) {
    router.push('/create')
    return
  }

  const cars = await db.cars.where('ownerId').equals(store.ownerId).toArray()
  if (cars.length) {
    car.value = cars[0]
    decryptedPlate.value = await decrypt(car.value.plate, store.masterKey)
  }

  token.value = generateToken()
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
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
        <h1 class="text-xl font-bold tracking-wider" style="text-transform: uppercase">
          ПОДЕЛИТЬСЯ С СЕРВИСОМ
        </h1>
      </div>
    </div>

    <BaseDivider />

    <!-- Car info -->
    <div class="mb-6 text-sm" style="color: #666">
      <div class="font-bold" style="color: #2A2A2A">{{ carTitle }}</div>
      <div v-if="car?.vin">VIN: <span class="font-mono">{{ car.vin }}</span></div>
      <div>Номер: <span class="font-mono uppercase">{{ decryptedPlate }}</span></div>
    </div>

    <BaseDivider />

    <!-- QR Code -->
    <div class="mb-6">
      <QRCode
        v-if="qrValue"
        :value="qrValue"
        :size="280"
      />
      <div v-else class="text-center py-8 text-lg" style="color: #999">
        {{ isRevoked ? 'ДОСТУП ОТОЗВАН' : 'СРОК ИСТЁК' }}
      </div>
    </div>

    <BaseDivider />

    <!-- Timer -->
    <div class="mb-6">
      <div class="flex items-center justify-center gap-2 mb-2">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12,6 12,12 16,14"/>
        </svg>
        <span class="text-sm" style="color: #666">АКТИВЕН ЕЩЁ:</span>
      </div>
      <CountdownTimer
        :expires-at="expiresAt"
        @expire="handleExpire"
      />
    </div>

    <BaseDivider />

    <!-- Duration buttons -->
    <div class="flex gap-2 mb-6">
      <button
        v-for="d in durations"
        :key="d.value"
        :class="[
          'flex-1 btn btn--sm',
          selectedDuration === d.value ? 'btn--primary' : 'btn--secondary'
        ]"
        @click="selectDuration(d)"
      >
        {{ d.label }}
      </button>
    </div>

    <BaseDivider />

    <!-- Actions -->
    <div class="flex gap-3 mb-6">
      <BaseButton
        label="ОТОЗВАТЬ ДОСТУП"
        variant="danger"
        @click="revokeAccess"
      />
      <BaseButton
        label="ОБНОВИТЬ QR"
        variant="secondary"
        @click="refreshQR"
      />
    </div>

    <!-- Footer -->
    <div class="text-center text-xs" style="color: #999">
      Данные зашифрованы
    </div>
  </div>
</template>
