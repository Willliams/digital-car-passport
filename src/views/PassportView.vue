<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { db } from '@/db'
import { decrypt, generateId } from '@/services/crypto'
import BaseDivider from '@/components/BaseDivider.vue'
import BaseButton from '@/components/BaseButton.vue'
import StatusStamp from '@/components/StatusStamp.vue'
import type { Owner, Car, ServiceRecord, Task, FuelRecord } from '@/types'

const router = useRouter()
const store = useAppStore()

const owner = ref<Owner | null>(null)
const car = ref<Car | null>(null)
const recentWorks = ref<ServiceRecord[]>([])
const recentTasks = ref<Task[]>([])
const fuelRecords = ref<FuelRecord[]>([])
const decryptedPhone = ref('')
const decryptedPlate = ref('')

const showMileageInput = ref(false)
const newMileage = ref<number | null>(null)
const mileageUpdateMessage = ref('')
const historyExpanded = ref(false)
const useMiles = ref(localStorage.getItem('mas_useMiles') === 'true')
const fuelPrice = ref(Number(localStorage.getItem('mas_fuelPrice')) || 55)
const fuelType = ref(localStorage.getItem('mas_fuelType') || 'АИ-92')
const showFuelTypePicker = ref(false)
const showAdditionalEditor = ref(false)

// Quick fuel entry
const newFuelLiters = ref<number | null>(null)
const newFuelPrice = ref<number | null>(null)
const quickFuelMessage = ref('')
const vinError = ref('')
const vinInput = ref('')

// VIN validation
const vinHint = 'ZAR94000007318181'.split('')

function onVinInput(e: Event) {
  const target = e.target as HTMLInputElement
  let value = target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '')
  if (value.length > 17) value = value.slice(0, 17)
  vinInput.value = value
  target.value = value

  if (value.length === 17) {
    vinError.value = ''
    saveCarField('vin', value)
  } else if (value.length > 0) {
    vinError.value = `${value.length}/17`
  } else {
    vinError.value = ''
  }
}

function initVinInput() {
  vinInput.value = car.value?.vin || ''
}

// Additional fields computed
const hasAdditionalFields = computed(() => {
  if (!car.value) return false
  return car.value.engineVolume || car.value.enginePower || car.value.weight ||
    car.value.insuranceNumber || frontFields.value.length > 0
})

const frontFields = computed(() => {
  return customFields.value.filter(f => {
    if (!f.name || !f.showOnFront) return false
    if (f.fieldType === 'counter') return f.counterDate || f.counterTargetMileage
    return f.value
  })
})

const bodyTypes = ['седан', 'хэтчбек', 'универсал', 'купе', 'кабриолет', 'внедорожник', 'минивэн', 'пикап', 'фургон', 'лифтбек', 'кроссовер']

const customFields = ref<{name: string; value: string; showOnFront: boolean; fieldType: 'text' | 'counter' | 'status'; counterDate?: string; counterTargetMileage?: number; counterEventType?: string; counterCustomEvent?: string}[]>([])

function loadCustomFields() {
  customFields.value = car.value?.customFields ? car.value.customFields.map(f => ({
    ...f,
    showOnFront: f.showOnFront || false,
    fieldType: f.fieldType || 'text',
    counterDate: f.counterDate || '',
    counterTargetMileage: f.counterTargetMileage || 0,
    counterEventType: f.counterEventType || '',
    counterCustomEvent: f.counterCustomEvent || ''
  })) : []
}

function addCustomField() {
  customFields.value.push({ name: '', value: '', showOnFront: false, fieldType: 'text' })
}

function onCounterEventChange(cf: any) {
  if (cf.counterEventType === 'custom') {
    cf.counterCustomEvent = ''
  }
  saveCustomFields()
}

function getCounterDaysLeft(cf: any): number | null {
  if (!cf.counterDate) return null
  const target = new Date(cf.counterDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

function getCounterKmLeft(cf: any): number | null {
  if (!cf.counterTargetMileage || !car.value) return null
  return cf.counterTargetMileage - (car.value.currentMileage || 0)
}

function getCounterDisplay(cf: any): string {
  const days = getCounterDaysLeft(cf)
  const km = getCounterKmLeft(cf)
  const parts: string[] = []
  if (days !== null) parts.push(Math.abs(days) + 'д')
  if (km !== null) parts.push(formatMileage(Math.abs(km)) + 'км')
  return parts.join('/') || '—'
}

function removeCustomField(index: number) {
  customFields.value.splice(index, 1)
  saveCustomFields()
}

async function saveCustomFields() {
  if (!car.value) return
  console.log('Saving custom fields:', customFields.value)
  await db.cars.update(car.value.id, { customFields: customFields.value })
  car.value.customFields = JSON.parse(JSON.stringify(customFields.value))
  console.log('Saved. car.customFields:', car.value.customFields)
}

// Insurance - date is issue date, expiry = +1 year
const insuranceExpiryDate = computed(() => {
  if (!car.value?.insuranceStartDate) return car.value?.insuranceEndDate || null
  const start = new Date(car.value.insuranceStartDate + 'T00:00:00')
  start.setFullYear(start.getFullYear() + 1)
  return start.toISOString().slice(0, 10)
})

const insuranceDaysLeft = computed(() => {
  const expiry = insuranceExpiryDate.value
  if (!expiry) return null
  const end = new Date(expiry + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - now.getTime()) / 86400000)
})

function onInsuranceDateChange() {
  if (!car.value?.insuranceStartDate) return
  const start = new Date(car.value.insuranceStartDate + 'T00:00:00')
  start.setFullYear(start.getFullYear() + 1)
  const endDate = start.toISOString().slice(0, 10)
  car.value.insuranceEndDate = endDate
  saveCarField('insuranceStartDate', car.value.insuranceStartDate)
  saveCarField('insuranceEndDate', endDate)
}

function toggleMiles() {
  useMiles.value = !useMiles.value
  localStorage.setItem('mas_useMiles', String(useMiles.value))
}

function saveFuelSettings() {
  localStorage.setItem('mas_fuelPrice', String(fuelPrice.value))
  localStorage.setItem('mas_fuelType', fuelType.value)
}

// Plate display like real Russian plate
const plateDisplay = computed(() => {
  if (!decryptedPlate.value) return ''
  const p = decryptedPlate.value.replace(/\s/g, '').toUpperCase()
  // Format: A 123 BB 77 or A 123 BB 777
  if (p.length >= 9) {
    return `${p[0]} ${p.slice(1, 4)} ${p.slice(4, 6)} ${p.slice(6, 9)}`
  }
  if (p.length >= 8) {
    return `${p[0]} ${p.slice(1, 4)} ${p.slice(4, 6)} ${p.slice(6, 8)}`
  }
  return p
})

// Mileage with leading zeros (odometer style)
const mileageDisplay = computed(() => {
  if (!car.value) return '0000000'
  const m = useMiles.value
    ? Math.round(car.value.currentMileage * 0.621371)
    : car.value.currentMileage
  return String(m).padStart(7, '0')
})

const mileageUnit = computed(() => useMiles.value ? 'МИЛ' : 'КМ')

const carTitle = computed(() => {
  if (!car.value) return ''
  return `${car.value.brand} ${car.value.model} ${car.value.year || ''}`
})

const hasAnyHistory = computed(() => recentWorks.value.length > 0 || recentTasks.value.length > 0)

// Nearest upcoming event
const nearestEvent = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = recentTasks.value
    .filter(t => t.date >= today && t.status !== 'done')
    .sort((a, b) => a.date.localeCompare(b.date))
  return upcoming.length > 0 ? upcoming[0] : null
})

function daysUntilEvent(date: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const event = new Date(date + 'T00:00:00')
  return Math.ceil((event.getTime() - today.getTime()) / 86400000)
}

// Fuel consumption stats
const fuelStats = computed(() => {
  if (fuelRecords.value.length < 2) return null

  const records = [...fuelRecords.value].sort((a, b) => a.mileage - b.mileage)

  let totalLiters = 0
  let totalDistance = 0

  for (let i = 1; i < records.length; i++) {
    const dist = records[i].mileage - records[i - 1].mileage
    if (dist > 0) {
      totalLiters += records[i].liters
      totalDistance += dist
    }
  }

  if (totalDistance === 0) return null

  const avgConsumption = (totalLiters / totalDistance) * 100
  const per1000km = avgConsumption * 10
  const costPer1000km = per1000km * fuelPrice.value

  // Analysis based on fuel type
  let status = 'normal'
  let analysis = ''
  const isDiesel = fuelType.value === 'ДТ'
  if (isDiesel) {
    if (avgConsumption < 5) { status = 'excellent'; analysis = 'Отличный расход для дизеля' }
    else if (avgConsumption < 8) { status = 'good'; analysis = 'Хороший расход' }
    else if (avgConsumption < 10) { status = 'normal'; analysis = 'Расход в норме' }
    else { status = 'high'; analysis = 'Возможен перерасход' }
  } else {
    if (avgConsumption < 6) { status = 'excellent'; analysis = 'Отличный расход для бензина' }
    else if (avgConsumption < 9) { status = 'good'; analysis = 'Хороший расход' }
    else if (avgConsumption < 12) { status = 'normal'; analysis = 'Расход в норме' }
    else { status = 'high'; analysis = 'Возможен перерасход' }
  }

  const statusColors: Record<string, string> = {
    excellent: '#556B2F',
    good: '#556B2F',
    normal: '#666',
    high: '#B91C1C'
  }

  return {
    avgConsumption: avgConsumption.toFixed(1),
    per1000km: per1000km.toFixed(0),
    totalLiters: totalLiters.toFixed(0),
    totalDistance: new Intl.NumberFormat('ru-RU').format(totalDistance),
    costPer1000km: new Intl.NumberFormat('ru-RU').format(Math.round(costPer1000km)),
    recordsCount: records.length,
    status,
    analysis,
    statusColor: statusColors[status]
  }
})

const lastFuel = computed(() => {
  if (fuelRecords.value.length === 0) return null
  const sorted = [...fuelRecords.value].sort((a, b) => b.mileage - a.mileage)
  return sorted[0]
})

function formatDate(d: string): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatPrice(p: number): string {
  return new Intl.NumberFormat('ru-RU').format(p) + ' ₽'
}

function formatMileage(m: number): string {
  return new Intl.NumberFormat('ru-RU').format(m)
}

async function saveQuickFuel() {
  if (!car.value || !newFuelLiters.value) return

  // Use current mileage from car
  const mileageInKm = car.value.currentMileage

  await db.fuel.add({
    id: generateId(),
    carId: car.value.id,
    date: new Date().toISOString().slice(0, 10),
    liters: newFuelLiters.value,
    mileage: mileageInKm,
    consumption: null
  })

  // Reload fuel records
  fuelRecords.value = await db.fuel.where('carId').equals(car.value.id).sortBy('mileage')

  // Reset form
  newFuelLiters.value = null
  newFuelPrice.value = null

  quickFuelMessage.value = 'Заправка сохранена'
  setTimeout(() => quickFuelMessage.value = '', 3000)
}

function getTaskStampStatus(status: string): 'in_progress' | 'ready' | 'paid' {
  if (status === 'done') return 'ready'
  if (status === 'in_progress') return 'in_progress'
  return 'in_progress'
}

function getTaskStatusLabel(status: string): string {
  if (status === 'done') return 'ГОТОВО'
  if (status === 'in_progress') return 'В РАБОТЕ'
  return 'ПЛАНИРУЕТСЯ'
}

async function changeFuelType(type: string) {
  if (!car.value) return
  await db.cars.update(car.value.id, { fuelType: type })
  car.value.fuelType = type
  showFuelTypePicker.value = false
}

async function saveCarField(field: string, value: string | undefined) {
  if (!car.value) return
  const update: Record<string, unknown> = {}
  update[field] = value || ''
  await db.cars.update(car.value.id, update as any)
}

// Feedback
const feedbackText = ref('')
const feedbackSent = ref(false)

function sendFeedback() {
  if (!feedbackText.value.trim()) return

  const feedbacks = JSON.parse(localStorage.getItem('garage_feedback') || '[]')
  feedbacks.push({
    text: feedbackText.value,
    date: new Date().toISOString(),
    user: owner.value?.name || 'Аноним'
  })
  localStorage.setItem('garage_feedback', JSON.stringify(feedbacks))

  feedbackText.value = ''
  feedbackSent.value = true
  setTimeout(() => feedbackSent.value = false, 3000)
}

function handleLogout() {
  store.lock()
  router.push('/login')
}

// Export/Import
async function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    owners: await db.owners.toArray(),
    cars: await db.cars.toArray(),
    services: await db.services.toArray(),
    fuel: await db.fuel.toArray(),
    tasks: await db.tasks.toArray()
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `garage-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function importData(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    if (!data.owners || !data.cars) {
      alert('Неверный формат файла')
      return
    }

    await db.transaction('rw', db.owners, db.cars, db.services, db.fuel, db.tasks, async () => {
      await db.owners.clear()
      await db.cars.clear()
      await db.services.clear()
      await db.fuel.clear()
      await db.tasks.clear()

      if (data.owners?.length) await db.owners.bulkAdd(data.owners)
      if (data.cars?.length) await db.cars.bulkAdd(data.cars)
      if (data.services?.length) await db.services.bulkAdd(data.services)
      if (data.fuel?.length) await db.fuel.bulkAdd(data.fuel)
      if (data.tasks?.length) await db.tasks.bulkAdd(data.tasks)
    })

    alert('Данные загружены! Обновите страницу.')
    location.reload()
  } catch (err) {
    alert('Ошибка чтения файла')
  }
}

function toggleMileageInput() {
  showMileageInput.value = !showMileageInput.value
  if (showMileageInput.value && car.value) {
    newMileage.value = car.value.currentMileage
  }
  mileageUpdateMessage.value = ''
}

async function updateMileage() {
  if (!car.value || !newMileage.value || newMileage.value < car.value.currentMileage) return

  const oldMileage = car.value.currentMileage
  const diff = newMileage.value - oldMileage

  await db.cars.update(car.value.id, { currentMileage: newMileage.value })
  car.value.currentMileage = newMileage.value

  mileageUpdateMessage.value = `Пробег обновлён: +${formatMileage(diff)} км`
  showMileageInput.value = false

  setTimeout(() => { mileageUpdateMessage.value = '' }, 3000)
}

function goToFuel() { router.push('/fuel') }
function goToQR() { router.push('/qr') }
function goToPlan() { router.push('/plan') }
function goToHistory() { router.push('/history') }
function goToTask() { router.push('/task') }
function goToMaintenance() { router.push('/plan') }

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
    loadCustomFields()

    const works = await db.services
      .where('carId')
      .equals(car.value.id)
      .reverse()
      .sortBy('date')
    recentWorks.value = works.slice(0, 3)

    const tasks = await db.tasks
      .where('carId')
      .equals(car.value.id)
      .reverse()
      .sortBy('date')
    recentTasks.value = tasks.slice(0, 5)

    const fuels = await db.fuel
      .where('carId')
      .equals(car.value.id)
      .sortBy('mileage')
    fuelRecords.value = fuels
  }
})
</script>

<template>
  <div v-if="car && owner">
    <!-- Header -->
    <div class="text-center mb-2">
      <div class="flex items-center justify-center gap-2 mb-2">
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"/>
          <path d="M3 21h18"/>
          <path d="M5 11h2"/>
          <path d="M17 11h2"/>
          <path d="M7 11v4h10v-4"/>
        </svg>
        <h1 class="text-xl font-bold tracking-wider" style="text-transform: uppercase">
          ЦИФРОВОЙ ГАРАЖ
        </h1>
      </div>
    </div>

    <BaseDivider />

    <!-- Car info -->
    <div class="mb-4">
      <!-- Brand -->
      <div class="text-2xl font-bold text-center" style="text-transform: uppercase; letter-spacing: 2px">{{ car?.brand }}</div>
      <!-- Model + Year -->
      <div class="text-lg font-semibold text-center mb-3" style="color: #2A2A2A; text-transform: lowercase">{{ car?.model }} {{ car?.year || '' }}</div>

      <!-- License plate + Fuel type -->
      <div class="flex items-center justify-center gap-2 mb-2">
        <div class="inline-block px-4 py-1.5" style="border: 1px dashed #999">
          <span class="text-lg font-bold tracking-wider" style="font-family: 'Courier New', monospace">{{ plateDisplay }}</span>
          <span class="text-[10px] ml-1" style="color: #999">RUS</span>
        </div>
        <button class="text-[10px] px-2 py-1 border border-dashed font-bold" style="border-color: #999; color: #2A2A2A"
          @click="showFuelTypePicker = !showFuelTypePicker">
          {{ car.fuelType || 'АИ-92' }}
        </button>
      </div>

      <!-- Fuel type picker -->
      <div v-if="showFuelTypePicker" class="flex gap-1 mb-2 justify-center">
        <button v-for="ft in ['АИ-92', 'АИ-95', 'АИ-100', 'ДТ', 'EV', 'Гибрид']" :key="ft"
          class="px-2 py-1 text-[10px] font-bold border transition-all"
          :class="car.fuelType === ft ? 'border-[#2A2A2A] bg-[#2A2A2A] text-white' : 'border-[#999] bg-white'"
          @click="changeFuelType(ft)">{{ ft }}</button>
      </div>

      <!-- VIN -->
      <div v-if="car.vin" class="text-center text-xs mb-1" style="color: #666">
        VIN: <span class="font-mono" style="color: #2A2A2A">{{ car.vin }}</span>
      </div>

      <!-- Standard additional fields -->
      <div class="text-center text-xs mt-1" style="color: #666">
        <span v-if="car.engineVolume" class="mr-3">Объём: <b style="color: #2A2A2A">{{ car.engineVolume }}</b></span>
        <span v-if="car.enginePower" class="mr-3">Мощность: <b style="color: #2A2A2A">{{ car.enginePower }}</b></span>
        <span v-if="car.weight" class="mr-3">Масса: <b style="color: #2A2A2A">{{ car.weight }} кг</b></span>
        <span v-if="car.insuranceNumber" class="mr-3">
          ОСАГО: <span class="font-mono" style="color: #2A2A2A">{{ car.insuranceNumber }}</span>
          <span v-if="insuranceDaysLeft !== null" :style="{ color: insuranceDaysLeft < 30 ? '#B91C1C' : '#556B2F' }">
            ({{ insuranceDaysLeft > 0 ? insuranceDaysLeft + ' дн.' : 'истекает!' }})
          </span>
        </span>
      </div>

      <!-- Custom fields with showOnFront -->
      <div v-if="frontFields.length" class="text-center text-xs mt-1" style="color: #666">
        <span v-for="(cf, i) in frontFields" :key="i" class="mr-3">
          <template v-if="cf.fieldType === 'counter'">
            <span :style="{ color: ((getCounterDaysLeft(cf) ?? 99) < 7 || (getCounterKmLeft(cf) ?? 99999) < 500) ? '#B91C1C' : '#2A2A2A' }">
              {{ cf.name || cf.counterCustomEvent || 'Счётчик' }} {{ getCounterDisplay(cf) }}
            </span>
          </template>
          <template v-else-if="cf.fieldType === 'status'">
            {{ cf.name }}: <b style="color: #2A2A2A; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; border: 1px solid #2A2A2A; padding: 1px 4px">{{ cf.value || '—' }}</b>
          </template>
          <template v-else>
            {{ cf.name }}: <b style="color: #2A2A2A">{{ cf.value }}</b>
          </template>
        </span>
      </div>
    </div>

    <BaseDivider />

    <!-- Owner -->
    <div class="mb-4 text-center">
      <div class="text-xs font-bold mb-1" style="color: #999; text-transform: uppercase; letter-spacing: 1px">Владелец</div>
      <div class="text-sm font-semibold" style="color: #2A2A2A">{{ owner.name }}</div>
      <div v-if="decryptedPhone" class="text-xs" style="color: #666">{{ decryptedPhone }}</div>
    </div>

    <BaseDivider />

    <!-- Edit additional fields -->
    <button class="mt-2 text-[10px] px-2 py-1 border border-dashed"
      style="border-color: #999; color: #666"
      @click="showAdditionalEditor = !showAdditionalEditor; if(showAdditionalEditor) initVinInput()">
      {{ showAdditionalEditor ? 'ЗАКРЫТЬ' : 'ДОПОЛНИТЕЛЬНЫЕ ДАННЫЕ' }}
    </button>

    <div v-if="showAdditionalEditor" class="mt-3 p-3 text-left" style="border: 1px dashed #999">
        <!-- All fields in consistent 2-col grid -->
        <div class="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label class="text-[10px]" style="color: #999">VIN</label>
            <div style="position: relative; height: 28px; border: 1px solid #999; background: white">
              <div style="position: absolute; inset: 0; display: flex; align-items: center; padding: 0 4px; font-family: monospace; font-size: 10px; letter-spacing: 1px; pointer-events: none; overflow: hidden">
                <span v-for="(ch, i) in vinHint" :key="i" :style="{ color: i < vinInput.length ? 'transparent' : '#ccc' }">{{ ch }}</span>
              </div>
              <input :value="vinInput" @input="onVinInput($event)" style="position: absolute; inset: 0; width: 100%; height: 100%; background: transparent; border: none; outline: none; font-family: monospace; font-size: 10px; letter-spacing: 1px; padding: 0 4px; color: #2A2A2A; text-transform: uppercase" maxlength="17" />
            </div>
          </div>
          <div>
            <label class="text-[10px]" style="color: #999">Кузов</label>
            <select v-model="car.bodyType" class="w-full px-2 py-1 text-xs border border-[#999] bg-white" style="height: 28px" @change="saveCarField('bodyType', car.bodyType)">
              <option value="">—</option>
              <option v-for="bt in bodyTypes" :key="bt" :value="bt">{{ bt }}</option>
            </select>
          </div>
          <div>
            <label class="text-[10px]" style="color: #999">Объём</label>
            <input v-model="car.engineVolume" class="w-full px-2 py-1 text-xs border border-[#999] bg-white" style="height: 28px" placeholder="2.0" @change="saveCarField('engineVolume', car.engineVolume)" />
          </div>
          <div>
            <label class="text-[10px]" style="color: #999">Мощность</label>
            <input v-model="car.enginePower" class="w-full px-2 py-1 text-xs border border-[#999] bg-white" style="height: 28px" placeholder="150 л.с." @change="saveCarField('enginePower', car.enginePower)" />
          </div>
          <div>
            <label class="text-[10px]" style="color: #999">ПТС</label>
            <input v-model="car.ptsNumber" class="w-full px-2 py-1 text-xs border border-[#999] bg-white" style="height: 28px" @change="saveCarField('ptsNumber', car.ptsNumber)" />
          </div>
          <div>
            <label class="text-[10px]" style="color: #999">СТС</label>
            <input v-model="car.stsNumber" class="w-full px-2 py-1 text-xs border border-[#999] bg-white" style="height: 28px" @change="saveCarField('stsNumber', car.stsNumber)" />
          </div>
          <div>
            <label class="text-[10px]" style="color: #999">Дата рег.</label>
            <input v-model="car.registrationDate" type="date" class="w-full px-2 py-1 text-xs border border-[#999] bg-white" style="height: 28px" @change="saveCarField('registrationDate', car.registrationDate)" />
          </div>
          <div>
            <label class="text-[10px]" style="color: #999">Масса (кг)</label>
            <input v-model="car.weight" class="w-full px-2 py-1 text-xs border border-[#999] bg-white" style="height: 28px" placeholder="1500" @change="saveCarField('weight', car.weight)" />
          </div>
        </div>

        <!-- Insurance (2 fields) -->
        <div class="border-t border-dashed mt-2 pt-2" style="border-color: #ccc">
          <div class="text-[10px] font-bold mb-2" style="color: #666">ОСАГО</div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px]" style="color: #999">Номер полиса</label>
              <input v-model="car.insuranceNumber" class="w-full px-2 py-1 text-xs border border-[#999] bg-white" style="height: 28px" placeholder="ААА 123456" @change="saveCarField('insuranceNumber', car.insuranceNumber)" />
            </div>
            <div>
              <label class="text-[10px]" style="color: #999">Дата выдачи</label>
              <input v-model="car.insuranceStartDate" type="date" class="w-full px-2 py-1 text-xs border border-[#999] bg-white" style="height: 28px" @change="onInsuranceDateChange" />
            </div>
          </div>
          <div v-if="insuranceExpiryDate" class="text-[9px] mt-1" style="color: #999">
            Действует до: {{ insuranceExpiryDate }}
            <span v-if="insuranceDaysLeft !== null" :style="{ color: insuranceDaysLeft < 30 ? '#B91C1C' : '#666' }">
              ({{ insuranceDaysLeft > 0 ? insuranceDaysLeft + ' дн.' : 'истекает!' }})
            </span>
          </div>
        </div>

        <!-- Custom fields -->
        <div class="border-t border-dashed mt-2 pt-2" style="border-color: #ccc">
          <div class="text-[10px] font-bold mb-2" style="color: #666">СВОЙСТВА</div>
          <div v-for="(cf, i) in customFields" :key="i" class="mb-2 p-2" style="border: 1px dashed #ddd">
            <!-- Row 1: Name + Type selector -->
            <div class="flex gap-1 items-center mb-1">
              <input v-model="cf.name" class="flex-1 px-2 py-1 text-[10px] border border-[#999] bg-white" style="height: 24px" placeholder="Название" @change="saveCustomFields" />
              <!-- Type carousel -->
              <div class="flex gap-0.5">
                <button v-for="t in [{id:'text',icon:'Т'},{id:'counter',icon:'#'},{id:'status',icon:'●'}]" :key="t.id"
                  class="w-6 h-6 text-[9px] font-bold border transition-all flex items-center justify-center"
                  :class="cf.fieldType === t.id ? 'border-[#2A2A2A] bg-[#2A2A2A] text-white' : 'border-[#999] bg-white'"
                  @click="cf.fieldType = t.id; saveCustomFields()">{{ t.icon }}</button>
              </div>
              <button class="text-[10px] px-1.5 py-0.5 border transition-colors"
                :style="{ borderColor: cf.showOnFront ? '#2A2A2A' : '#999', background: cf.showOnFront ? '#2A2A2A' : 'white', color: cf.showOnFront ? 'white' : '#999' }"
                @click="cf.showOnFront = !cf.showOnFront; saveCustomFields()">
                {{ cf.showOnFront ? '✓' : '○' }}
              </button>
              <button class="text-[10px] px-1" style="color: #999" @click="removeCustomField(i)">✕</button>
            </div>

            <!-- Row 2: Type-specific fields -->
            <!-- TEXT type -->
            <div v-if="cf.fieldType === 'text' || !cf.fieldType">
              <input v-model="cf.value" class="w-full px-2 py-1 text-[10px] border border-[#999] bg-white" style="height: 24px" placeholder="Значение" @change="saveCustomFields" />
            </div>

            <!-- COUNTER type -->
            <div v-if="cf.fieldType === 'counter'" class="space-y-1">
              <div class="flex gap-1">
                <select v-model="cf.counterEventType" class="flex-1 px-2 py-1 text-[10px] border border-[#999] bg-white" style="height: 24px" @change="saveCustomFields()">
                  <option value="">Событие...</option>
                  <option value="oil">Замена масла</option>
                  <option value="brakes">Тормоза</option>
                  <option value="inspection">ТО</option>
                  <option value="filters">Фильтры</option>
                  <option value="custom">Своё...</option>
                </select>
                <input v-if="cf.counterEventType === 'custom'" v-model="cf.counterCustomEvent" class="flex-1 px-2 py-1 text-[10px] border border-[#999] bg-white" style="height: 24px" placeholder="Название" @change="saveCustomFields" />
              </div>
              <div class="flex gap-1">
                <div class="flex-1">
                  <label class="text-[9px]" style="color: #999">Напомнить (дата)</label>
                  <input v-model="cf.counterDate" type="date" class="w-full px-2 py-1 text-[10px] border border-[#999] bg-white" style="height: 24px" @change="saveCustomFields" />
                </div>
                <div class="flex-1">
                  <label class="text-[9px]" style="color: #999">ИЛИ (пробег км)</label>
                  <input v-model.number="cf.counterTargetMileage" type="number" min="0" step="100" class="w-full px-2 py-1 text-[10px] border border-[#999] bg-white" style="height: 24px" :placeholder="String((car?.currentMileage || 0) + 10000)" @change="saveCustomFields" />
                </div>
              </div>
              <div v-if="getCounterDaysLeft(cf) !== null || getCounterKmLeft(cf) !== null" class="text-[9px] p-1" style="background: #F5F5F0">
                <span :style="{ color: ((getCounterDaysLeft(cf) ?? 99) < 7 || (getCounterKmLeft(cf) ?? 99999) < 500) ? '#B91C1C' : '#666' }">
                  {{ getCounterDisplay(cf) }}
                </span>
              </div>
            </div>

            <!-- STATUS type -->
            <div v-if="cf.fieldType === 'status'">
              <input v-model="cf.value" class="w-full px-2 py-1 text-[10px] border border-[#999] bg-white" style="height: 24px" placeholder="Статус" @change="saveCustomFields" />
            </div>
          </div>
          <button class="text-[10px] px-2 py-1 border border-dashed" style="border-color: #999; color: #666" @click="addCustomField">
            + ДОБАВИТЬ ПОЛЕ
          </button>
        </div>
      </div>

    <BaseDivider />

    <!-- Mileage (odometer style) + Add fuel -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-bold" style="text-transform: uppercase; letter-spacing: 1px">
          ПРОБЕГ
        </h2>
        <button
          class="text-xs px-2 py-1 border border-dashed"
          style="border-color: #999; color: #666"
          @click="toggleMiles"
        >
          {{ useMiles ? 'КМ' : 'МИЛИ' }}
        </button>
      </div>

      <!-- Odometer display (receipt style) -->
      <div class="p-4 text-center" style="border: 1px dashed #999; background: #F5F5F0">
        <div class="text-3xl font-bold mb-1" style="font-family: 'Courier New', monospace; color: #2A2A2A; letter-spacing: 0.5em; word-spacing: 0.3em">
          {{ mileageDisplay }}
        </div>
        <div class="text-xs tracking-widest" style="color: #666">{{ mileageUnit }}</div>
      </div>

      <div class="flex items-center justify-between mt-2">
        <div class="text-xs" style="color: #666">
          {{ formatDate(new Date().toISOString().slice(0, 10)) }}
        </div>
        <button
          class="text-xs px-3 py-1.5 border border-dashed transition-colors"
          style="border-color: #999; color: #4A6FA5"
          @click="toggleMileageInput"
        >
          {{ showMileageInput ? 'ОТМЕНА' : 'ОБНОВИТЬ ПРОБЕГ' }}
        </button>
      </div>

      <div v-if="mileageUpdateMessage" class="text-xs mt-2 font-bold" style="color: #556B2F">
        {{ mileageUpdateMessage }}
      </div>

      <div v-if="showMileageInput" class="mt-3 flex items-end gap-2">
        <div class="flex-1">
          <label class="block text-xs mb-1" style="color: #666">Новый пробег ({{ useMiles ? 'мили' : 'км' }})</label>
          <input
            v-model.number="newMileage"
            type="number"
            :min="useMiles ? Math.round((car?.currentMileage || 0) * 0.621371) : car?.currentMileage || 0"
            class="input-field"
          />
        </div>
        <button
          class="btn btn--primary btn--sm"
          style="width: auto; padding: 0 16px; height: 48px"
          @click="updateMileage"
        >
          ОК
        </button>
      </div>

      <!-- Add fuel (compact, under mileage) -->
      <div class="mt-3 p-3" style="border: 1px dashed #999">
        <div class="text-xs font-bold mb-2" style="color: #666; text-transform: uppercase">Добавить заправку</div>

        <div class="flex gap-2 mb-2">
          <div class="flex-1">
            <label class="text-[10px]" style="color: #999">Литры</label>
            <input v-model.number="newFuelLiters" type="number" min="0" step="0.1"
              class="w-full px-2 py-1.5 text-xs border border-[#999] bg-white" style="height: 32px" placeholder="0" />
          </div>
          <div style="width: 70px">
            <label class="text-[10px]" style="color: #999">Цена ₽</label>
            <input v-model.number="newFuelPrice" type="number" min="0"
              class="w-full px-2 py-1.5 text-xs border border-[#999] bg-white" style="height: 32px" :placeholder="String(fuelPrice)" />
          </div>
        </div>

        <div class="text-[10px] mb-2" style="color: #999">
          Пробег: {{ mileageDisplay }} {{ mileageUnit }} (текущий)
        </div>

        <button class="btn btn--primary btn--sm" style="height: 36px; font-size: 11px"
          :disabled="!newFuelLiters"
          @click="saveQuickFuel">
          СОХРАНИТЬ
        </button>

        <div v-if="quickFuelMessage" class="text-xs mt-2 font-bold" style="color: #556B2F">
          {{ quickFuelMessage }}
        </div>
      </div>
    </div>

    <BaseDivider />

    <!-- Fuel consumption stats -->
    <div class="mb-6">
      <h2 class="text-sm font-bold mb-3" style="text-transform: uppercase; letter-spacing: 1px">
        РАСХОД ТОПЛИВА
      </h2>

      <div v-if="fuelStats" class="space-y-2">
        <div class="flex justify-between text-sm">
          <span style="color: #666">Средний расход:</span>
          <span class="font-bold">{{ fuelStats.avgConsumption }} л/100км</span>
        </div>

        <!-- Analysis -->
        <div class="p-3 mt-2" style="border: 1px dashed #999">
          <div class="text-sm font-bold" style="color: #2A2A2A">
            {{ fuelStats.analysis }}
          </div>
          <div class="text-xs mt-1" style="color: #999">
            {{ fuelType }} | {{ fuelPrice }} ₽/л
          </div>
        </div>

        <!-- Last fuel records -->
        <div v-if="fuelRecords.length" class="mt-3">
          <div class="text-xs font-bold mb-1" style="color: #666; text-transform: uppercase">Последние заправки:</div>
          <div v-for="f in fuelRecords.slice(-3).reverse()" :key="f.id" class="flex justify-between text-xs py-1 border-b border-dashed" style="border-color: #ccc">
            <span style="color: #666">{{ formatDate(f.date) }}</span>
            <span class="font-bold">{{ f.liters }} л</span>
            <span style="color: #999">{{ formatMileage(useMiles ? Math.round(f.mileage * 0.621371) : f.mileage) }} {{ useMiles ? 'ми' : 'км' }}</span>
          </div>
        </div>
      </div>

      <div v-else class="text-sm" style="color: #666">
        Нет данных о заправках
      </div>
    </div>

    <BaseDivider />

    <!-- Nearest event -->
    <div v-if="nearestEvent" class="mb-6">
      <div class="flex items-center gap-2 p-3" style="border: 1px dashed #999">
        <svg class="w-5 h-5 shrink-0" style="color: #666" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12,6 12,12 16,14"/>
        </svg>
        <div>
          <div class="text-sm font-bold">{{ nearestEvent.title }}</div>
          <div class="text-xs" style="color: #666">
            {{ formatDate(nearestEvent.date) }}
            <span v-if="daysUntilEvent(nearestEvent.date) === 0"> (сегодня)</span>
            <span v-else-if="daysUntilEvent(nearestEvent.date) === 1"> (завтра)</span>
            <span v-else> (через {{ daysUntilEvent(nearestEvent.date) }} дн.)</span>
          </div>
        </div>
      </div>
    </div>

    <BaseDivider v-if="nearestEvent" />

    <!-- History section (collapsed) -->
    <div class="mb-6">
      <button
        class="flex items-center justify-between w-full text-left"
        @click="historyExpanded = !historyExpanded"
      >
        <h2 class="text-sm font-bold" style="text-transform: uppercase; letter-spacing: 1px">
          ИСТОРИЯ ОБСЛУЖИВАНИЯ
        </h2>
        <span class="text-xs" style="color: #666">
          {{ historyExpanded ? '\u25B2 Свернуть' : '\u25BC Показать' }}
          <span v-if="hasAnyHistory"> ({{ recentWorks.length + recentTasks.length }})</span>
        </span>
      </button>

      <div v-if="historyExpanded" class="mt-3">
        <div v-if="recentWorks.length" class="space-y-3 mb-4">
          <div
            v-for="w in recentWorks"
            :key="w.id"
            class="flex items-start justify-between gap-3 py-2 border-b border-dashed"
            style="border-color: #999"
          >
            <div class="flex-1">
              <div class="text-sm" style="color: #666">{{ formatDate(w.date) }} — {{ w.serviceName }}</div>
              <div class="text-sm mt-1">
                <span v-for="(work, i) in w.works" :key="i">
                  {{ work.name }}<span v-if="i < w.works.length - 1">, </span>
                </span>
              </div>
              <div class="text-xs mt-1" style="color: #666">{{ formatMileage(w.mileage) }} км</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold">{{ formatPrice(w.totalCost) }}</div>
              <StatusStamp :status="w.status" size="sm" />
            </div>
          </div>
        </div>

        <div v-if="recentTasks.length" class="space-y-3">
          <div
            v-for="task in recentTasks"
            :key="task.id"
            class="flex items-start justify-between gap-3 py-2 border-b border-dashed"
            style="border-color: #999"
          >
            <div class="flex-1">
              <div class="text-sm font-bold">{{ task.title }}</div>
              <div v-if="task.description" class="text-xs mt-1" style="color: #666">{{ task.description }}</div>
              <div class="text-xs mt-1" style="color: #666">{{ formatDate(task.date) }}</div>
            </div>
            <div class="text-right">
              <StatusStamp :status="getTaskStampStatus(task.status)" size="sm" />
              <div class="text-[10px] mt-1" style="color: #666">{{ getTaskStatusLabel(task.status) }}</div>
            </div>
          </div>
        </div>

        <div v-if="!hasAnyHistory" class="text-sm" style="color: #666">Нет записей</div>

        <button
          v-if="hasAnyHistory"
          class="mt-3 text-sm underline"
          style="color: #4A6FA5"
          @click="goToHistory"
        >
          Смотреть всю историю
        </button>
      </div>
    </div>

    <BaseDivider />

    <!-- Planned TO (active link) -->
    <div class="mb-6">
      <button
        class="flex items-center justify-between w-full text-left p-3 border border-dashed transition-colors"
        style="border-color: #999; color: #2A2A2A"
        @click="goToMaintenance"
      >
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          <span class="text-sm font-bold" style="text-transform: uppercase">ПЛАНОВОЕ ТО</span>
        </div>
        <span class="text-lg">\u2192</span>
      </button>
    </div>

    <BaseDivider />

    <!-- Actions (styled) -->
    <div class="space-y-3 mb-6">
      <button class="btn btn--primary" @click="goToQR">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
        <span>ПОДЕЛИТЬСЯ QR-КОДОМ</span>
      </button>

      <button class="btn btn--secondary" @click="goToPlan">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>ЗАПИСАТЬСЯ НА ТО</span>
      </button>

      <button class="btn btn--secondary" @click="goToTask">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span>СОЗДАТЬ ЗАДАНИЕ</span>
      </button>
    </div>

    <!-- Export/Import -->
    <div class="mb-4 p-3" style="border: 1px dashed #999">
      <div class="text-[10px] font-bold mb-2" style="color: #666; text-transform: uppercase">ДАННЫЕ</div>
      <div class="flex gap-2">
        <button class="flex-1 py-2 text-[10px] border border-dashed"
          style="border-color: #999; color: #666" @click="exportData">
          ВЫГРУЗКА
        </button>
        <label class="flex-1 py-2 text-[10px] border border-dashed text-center cursor-pointer"
          style="border-color: #999; color: #666">
          ЗАГРУЗКА
          <input type="file" accept=".json" @change="importData" class="hidden" />
        </label>
      </div>
    </div>

    <!-- Feedback -->
    <div class="mb-4">
      <div class="text-[10px] font-bold mb-1" style="color: #999; text-transform: uppercase; letter-spacing: 1px">Обратная связь</div>
      <textarea v-model="feedbackText" rows="2" placeholder="Ваши предложения, замечания..."
        class="w-full px-3 py-2 text-xs border border-dashed bg-white resize-none"
        style="border-color: #999; height: 48px"></textarea>
      <button v-if="feedbackText" class="mt-1 text-[10px] px-3 py-1 border border-dashed"
        style="border-color: #999; color: #666" @click="sendFeedback">
        ОТПРАВИТЬ
      </button>
      <div v-if="feedbackSent" class="text-[10px] mt-1" style="color: #556B2F">Спасибо за обратную связь!</div>
    </div>

    <!-- Logout -->
    <button class="w-full py-2 text-[10px] border border-dashed mb-4"
      style="border-color: #999; color: #999; text-transform: uppercase; letter-spacing: 1px"
      @click="handleLogout">
      ВЫЙТИ
    </button>

    <!-- Footer -->
    <div class="text-center text-xs" style="color: #999">
      Данные зашифрованы
    </div>
  </div>
</template>
