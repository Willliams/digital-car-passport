<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { db } from '@/db'
import { createMasterKey, encrypt, generateId } from '@/services/crypto'
import { CAR_BRANDS, CAR_MODELS } from '@/services/carBrands'
import BaseDivider from '@/components/BaseDivider.vue'

const router = useRouter()
const store = useAppStore()

const name = ref('')
const phone = ref('')
const brand = ref('')
const model = ref('')
const year = ref<number | null>(null)
const plate = ref('')
const fuelType = ref('АИ-92')

const brandSuggestions = ref<string[]>([])
const showSuggestions = ref(false)
const errorMessage = ref('')

const currentYear = new Date().getFullYear()

function onBrandInput() {
  const q = brand.value.toLowerCase()
  if (q.length < 1) {
    showSuggestions.value = false
    return
  }
  brandSuggestions.value = CAR_BRANDS.filter(b =>
    b.toLowerCase().includes(q)
  ).slice(0, 8)
  showSuggestions.value = brandSuggestions.value.length > 0
}

function selectBrand(b: string) {
  brand.value = b
  showSuggestions.value = false
}

function hideSuggestions() {
  setTimeout(() => { showSuggestions.value = false }, 200)
}

function onPhoneInput(e: Event) {
  const target = e.target as HTMLInputElement
  let value = target.value.replace(/\D/g, '')
  if (value.length > 0) {
    if (value[0] === '7' || value[0] === '8') value = value.slice(1)
    let formatted = '+7'
    if (value.length > 0) formatted += ' (' + value.slice(0, 3)
    if (value.length >= 3) formatted += ') ' + value.slice(3, 6)
    if (value.length >= 6) formatted += '-' + value.slice(6, 8)
    if (value.length >= 8) formatted += '-' + value.slice(8, 10)
    phone.value = formatted
  } else {
    phone.value = ''
  }
}

function onPlateInput(e: Event) {
  const target = e.target as HTMLInputElement
  plate.value = target.value.toUpperCase()
}

async function createPassport() {
  errorMessage.value = ''

  if (!name.value.trim()) {
    errorMessage.value = 'Введите имя'
    return
  }
  if (!brand.value.trim()) {
    errorMessage.value = 'Введите марку автомобиля'
    return
  }
  if (!model.value.trim()) {
    errorMessage.value = 'Введите модель автомобиля'
    return
  }
  if (plate.value.trim().length < 6) {
    errorMessage.value = 'Введите госномер (минимум 6 символов)'
    return
  }

  try {
    console.log('Starting passport creation...')

    console.log('Creating master key...')
    const masterKey = await createMasterKey()
    console.log('Master key created:', masterKey ? 'OK' : 'FAIL')

    const ownerId = generateId()
    console.log('Owner ID:', ownerId)

    console.log('Encrypting phone...')
    const encryptedPhone = phone.value ? await encrypt(phone.value, masterKey) : ''
    console.log('Phone encrypted:', encryptedPhone ? 'OK' : 'empty')

    console.log('Encrypting plate...')
    const encryptedPlate = await encrypt(plate.value, masterKey)
    console.log('Plate encrypted:', encryptedPlate ? 'OK' : 'FAIL')

    console.log('Adding owner to DB...')
    await db.owners.add({
      id: ownerId,
      name: name.value,
      phone: encryptedPhone,
      publicKey: masterKey,
      createdAt: new Date().toISOString()
    })
    console.log('Owner added OK')

    console.log('Adding car to DB...')
    await db.cars.add({
      id: generateId(),
      ownerId,
      brand: brand.value,
      model: model.value,
      year: year.value,
      vin: '',
      plate: encryptedPlate,
      fuelType: fuelType.value,
      currentMileage: 0
    })
    console.log('Car added OK')

    console.log('Unlocking store...')
    store.unlock(masterKey, ownerId)
    console.log('Store unlocked, navigating...')
    router.push('/')
  } catch (err) {
    console.error('Passport creation error:', err)
    const errorDetail = err instanceof Error ? err.message : String(err)
    errorMessage.value = 'Ошибка: ' + errorDetail
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="text-center mb-2">
      <div class="flex items-center justify-center gap-2 mb-2">
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
        <h1 class="text-xl font-bold tracking-wider" style="text-transform: uppercase">
          ЦИФРОВОЙ ПАСПОРТ
        </h1>
      </div>
      <p class="text-sm" style="color: #666; line-height: 1.5">
        Это электронная история вашего авто.<br>
        Все ремонты, замены и обслуживание будут храниться здесь —<br>
        доступно вам в любой момент.
      </p>
    </div>

    <BaseDivider />

    <!-- Error message -->
    <div v-if="errorMessage" class="mb-4 p-3 text-sm" style="background: #FEE2E2; color: #B91C1C">
      {{ errorMessage }}
    </div>

    <!-- Owner section -->
    <div class="mb-6">
      <h2 class="text-sm font-bold mb-4" style="text-transform: uppercase; letter-spacing: 1px">
        ВАШИ ДАННЫЕ
      </h2>
      <div class="space-y-3">
        <div>
          <label class="block text-xs mb-1" style="color: #666">Имя *</label>
          <input
            v-model="name"
            type="text"
            placeholder="Иван Иванов"
            class="input-field"
          />
        </div>
        <div>
          <label class="block text-xs mb-1" style="color: #666">Телефон</label>
          <input
            :value="phone"
            type="tel"
            placeholder="+7 (999) 123-45-67"
            class="input-field"
            @input="onPhoneInput"
          />
        </div>
      </div>
    </div>

    <BaseDivider />

    <!-- Car section -->
    <div class="mb-6">
      <h2 class="text-sm font-bold mb-4" style="text-transform: uppercase; letter-spacing: 1px">
        ВАШ АВТОМОБИЛЬ
      </h2>
      <div class="space-y-3">
        <!-- Brand -->
        <div>
          <label class="block text-xs mb-1" style="color: #666">Марка *</label>
          <div class="relative">
            <input
              v-model="brand"
              type="text"
              placeholder="Toyota"
              class="input-field"
              @input="onBrandInput"
              @blur="hideSuggestions"
            />
            <div
              v-if="showSuggestions && brandSuggestions.length"
              class="w-full bg-white border border-[#999] max-h-48 overflow-y-auto"
              style="position: absolute; top: 100%; left: 0; right: 0; z-index: 9999"
            >
              <div
                v-for="b in brandSuggestions"
                :key="b"
                class="px-4 py-3 text-sm cursor-pointer"
                style="border-bottom: 1px dashed #999"
                @mousedown.prevent="selectBrand(b)"
                @touchend.prevent="selectBrand(b)"
              >
                {{ b }}
              </div>
            </div>
          </div>
          <p class="text-xs mt-1" style="color: #666">Начните вводить — мы подскажем</p>
        </div>

        <!-- Model -->
        <div>
          <label class="block text-xs mb-1" style="color: #666">Модель *</label>
          <select v-if="CAR_MODELS[brand]" v-model="model" class="input-field">
            <option value="">Выберите модель</option>
            <option v-for="m in CAR_MODELS[brand]" :key="m" :value="m">{{ m }}</option>
          </select>
          <input
            v-else
            v-model="model"
            type="text"
            placeholder="Camry"
            class="input-field"
          />
        </div>

        <!-- Year -->
        <div>
          <label class="block text-xs mb-1" style="color: #666">Год выпуска</label>
          <input
            v-model.number="year"
            type="number"
            placeholder="2024"
            :min="1900"
            :max="currentYear + 1"
            class="input-field"
          />
        </div>

        <!-- Plate -->
        <div>
          <label class="block text-xs mb-1" style="color: #666">Государственный номер *</label>
          <input
            :value="plate"
            type="text"
            placeholder="А123БВ77"
            class="input-field uppercase"
            maxlength="9"
            @input="onPlateInput"
          />
        </div>

        <!-- Fuel type -->
        <div>
          <label class="block text-xs mb-1" style="color: #666">Тип топлива</label>
          <div class="flex gap-1">
            <button v-for="ft in ['АИ-92', 'АИ-95', 'АИ-100', 'ДТ', 'EV', 'Гибрид']" :key="ft"
              class="flex-1 py-2 text-[11px] font-bold border transition-all"
              :class="fuelType === ft ? 'border-[#2A2A2A] bg-[#2A2A2A] text-white' : 'border-[#999] bg-white'"
              style="text-transform: uppercase"
              @click="fuelType = ft"
            >{{ ft }}</button>
          </div>
        </div>
      </div>
    </div>

    <BaseDivider />

    <!-- Privacy block -->
    <div class="mb-6 p-4" style="background: #F1F5F9">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <p class="text-sm" style="color: #666; line-height: 1.5">
          Ваши данные защищены и хранятся только у вас.<br>
          Мы не передаем их третьим лицам.
        </p>
      </div>
    </div>

    <!-- Submit -->
    <button
      class="btn btn--primary"
      @click="createPassport"
    >
      СОЗДАТЬ ЦИФРОВОЙ ПАСПОРТ
    </button>
  </div>
</template>
