<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { db } from '@/db'
import { createMasterKey, encrypt, decrypt, generateId } from '@/services/crypto'

const router = useRouter()
const store = useAppStore()

const mode = ref<'login' | 'register'>('login')
const phone = ref('')
const password = ref('')
const name = ref('')
const error = ref('')
const loading = ref(false)
const importMsg = ref('')
const importOk = ref(false)

// Test users for debug
const testUsers = [
  { phone: '+79991112233', password: '9999', name: 'Иван Петров' },
  { phone: '+79994445566', password: '9999', name: 'Алексей Сидоров' },
  { phone: '+79997778899', password: '9999', name: 'Мария Козлова' },
]

async function exportAllData() {
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

async function importAllData(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    if (!data.owners || !data.cars) {
      importMsg.value = 'Неверный формат файла'
      importOk.value = false
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

    importMsg.value = `Загружено: ${data.owners?.length || 0} пользователей, ${data.cars?.length || 0} авто`
    importOk.value = true
    target.value = ''
  } catch (err) {
    importMsg.value = 'Ошибка чтения файла'
    importOk.value = false
  }
}

function formatPhone(e: Event) {
  const target = e.target as HTMLInputElement
  let v = target.value.replace(/\D/g, '')
  if (v.length > 0) {
    if (v[0] === '7' || v[0] === '8') v = v.slice(1)
    let f = '+7'
    if (v.length > 0) f += ' (' + v.slice(0, 3)
    if (v.length >= 3) f += ') ' + v.slice(3, 6)
    if (v.length >= 6) f += '-' + v.slice(6, 8)
    if (v.length >= 8) f += '-' + v.slice(8, 10)
    phone.value = f
  } else {
    phone.value = ''
  }
}

async function handleLogin() {
  error.value = ''
  loading.value = true

  const cleanPhone = phone.value.replace(/\D/g, '')
  if (cleanPhone.length < 10) {
    error.value = 'Введите номер телефона'
    loading.value = false
    return
  }

  // Check test users
  const testUser = testUsers.find(u => u.phone.replace(/\D/g, '') === cleanPhone && u.password === password.value)
  if (testUser) {
    // Find or create owner in DB
    const owners = await db.owners.toArray()
    let owner = owners.find(o => {
      // For test users, match by name since phone is encrypted
      return o.name === testUser.name
    })

    if (!owner) {
      // Create new owner
      const masterKey = await createMasterKey()
      const ownerId = generateId()
      const encryptedPhone = await encrypt(testUser.phone, masterKey)

      await db.owners.add({
        id: ownerId,
        name: testUser.name,
        phone: encryptedPhone,
        publicKey: masterKey,
        createdAt: new Date().toISOString()
      })

      // Create default car
      await db.cars.add({
        id: generateId(),
        ownerId,
        brand: 'Toyota',
        model: 'Camry',
        year: 2023,
        vin: '',
        plate: await encrypt('A123BC777', masterKey),
        fuelType: 'АИ-92',
        currentMileage: 10000
      })

      store.unlock(masterKey, ownerId)
    } else {
      store.unlock(owner.publicKey, owner.id)
    }

    router.push('/')
  } else {
    // Check DB users
    const owners = await db.owners.toArray()
    for (const owner of owners) {
      try {
        const decryptedPhone = await decrypt(owner.phone, owner.publicKey)
        const decryptedClean = decryptedPhone.replace(/\D/g, '')
        if (decryptedClean === cleanPhone && password.value === '9999') {
          store.unlock(owner.publicKey, owner.id)
          router.push('/')
          loading.value = false
          return
        }
      } catch {}
    }
    error.value = 'Неверный номер или пароль'
  }
  loading.value = false
}

async function handleRegister() {
  error.value = ''
  loading.value = true

  const cleanPhone = phone.value.replace(/\D/g, '')
  if (cleanPhone.length < 10) {
    error.value = 'Введите номер телефона'
    loading.value = false
    return
  }
  if (!name.value.trim()) {
    error.value = 'Введите имя'
    loading.value = false
    return
  }
  if (password.value !== '9999') {
    error.value = 'Пароль: 9999'
    loading.value = false
    return
  }

  try {
    const masterKey = await createMasterKey()
    const ownerId = generateId()
    const encryptedPhone = await encrypt(phone.value, masterKey)

    await db.owners.add({
      id: ownerId,
      name: name.value,
      phone: encryptedPhone,
      publicKey: masterKey,
      createdAt: new Date().toISOString()
    })

    store.unlock(masterKey, ownerId)
    router.push('/')
  } catch (err) {
    error.value = 'Ошибка регистрации'
  }
  loading.value = false
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-8" style="background: #F5F5F0">
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-6">
        <div class="inline-flex items-center justify-center w-16 h-16 mb-3" style="border: 2px dashed #999">
          <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#2A2A2A" stroke-width="2">
            <path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"/>
            <path d="M3 21h18"/>
            <path d="M5 11h2"/>
            <path d="M17 11h2"/>
            <path d="M7 11v4h10v-4"/>
          </svg>
        </div>
        <h1 class="text-2xl font-bold" style="text-transform: uppercase; letter-spacing: 2px">ЦИФРОВОЙ ГАРАЖ</h1>
        <p class="text-xs mt-1" style="color: #666">Управление автомобилем</p>
      </div>

      <!-- Tabs -->
      <div class="flex mb-4" style="border: 1px dashed #999">
        <button class="flex-1 py-2 text-sm font-bold transition-all"
          :class="mode === 'login' ? 'bg-[#2A2A2A] text-white' : 'bg-white text-[#666]'"
          @click="mode = 'login'; error = ''">ВХОД</button>
        <button class="flex-1 py-2 text-sm font-bold transition-all"
          :class="mode === 'register' ? 'bg-[#2A2A2A] text-white' : 'bg-white text-[#666]'"
          @click="mode = 'register'; error = ''">РЕГИСТРАЦИЯ</button>
      </div>

      <!-- Error -->
      <div v-if="error" class="mb-3 p-2 text-xs text-center" style="background: #FEE2E2; color: #B91C1C">
        {{ error }}
      </div>

      <!-- Login form -->
      <div v-if="mode === 'login'" class="space-y-3">
        <div>
          <label class="text-xs mb-1 block" style="color: #666">Телефон</label>
          <input :value="phone" type="tel" placeholder="+7 (999) 123-45-67"
            class="input-field" @input="formatPhone($event)" />
        </div>
        <div>
          <label class="text-xs mb-1 block" style="color: #666">Пароль</label>
          <input v-model="password" type="password" placeholder="9999"
            class="input-field" maxlength="4" />
        </div>
        <button class="btn btn--primary" @click="handleLogin" :disabled="loading">
          {{ loading ? '...' : 'ВОЙТИ' }}
        </button>
      </div>

      <!-- Register form -->
      <div v-if="mode === 'register'" class="space-y-3">
        <div>
          <label class="text-xs mb-1 block" style="color: #666">Имя</label>
          <input v-model="name" type="text" placeholder="Иван Иванов"
            class="input-field" />
        </div>
        <div>
          <label class="text-xs mb-1 block" style="color: #666">Телефон</label>
          <input :value="phone" type="tel" placeholder="+7 (999) 123-45-67"
            class="input-field" @input="formatPhone($event)" />
        </div>
        <div>
          <label class="text-xs mb-1 block" style="color: #666">Пароль</label>
          <input v-model="password" type="password" placeholder="9999"
            class="input-field" maxlength="4" />
        </div>
        <button class="btn btn--primary" @click="handleRegister" :disabled="loading">
          {{ loading ? '...' : 'ЗАРЕГИСТРИРОВАТЬСЯ' }}
        </button>
      </div>

      <!-- Test users hint -->
      <div class="mt-6 p-3 text-center" style="border: 1px dashed #999">
        <div class="text-[10px] font-bold mb-1" style="color: #666">ТЕСТОВЫЕ АККАУНТЫ</div>
        <div class="text-[10px]" style="color: #999">
          <div v-for="u in testUsers" :key="u.phone" class="mb-0.5">
            {{ u.phone }} / {{ u.password }} — {{ u.name }}
          </div>
        </div>
      </div>

      <div class="text-center mt-4 text-[10px]" style="color: #999">
        Пароль для всех: 9999
      </div>

      <!-- Export/Import -->
      <div class="mt-4 p-3" style="border: 1px dashed #999">
        <div class="text-[10px] font-bold mb-2 text-center" style="color: #666">ДАННЫЕ</div>
        <div class="flex gap-2">
          <button class="flex-1 py-2 text-[10px] border border-dashed"
            style="border-color: #999; color: #666" @click="exportAllData">
            ВЫГРУЗКА
          </button>
          <label class="flex-1 py-2 text-[10px] border border-dashed text-center cursor-pointer"
            style="border-color: #999; color: #666">
            ЗАГРУЗКА
            <input type="file" accept=".json" @change="importAllData" class="hidden" />
          </label>
        </div>
        <div v-if="importMsg" class="text-[10px] mt-1 text-center" :style="{ color: importOk ? '#556B2F' : '#B91C1C' }">
          {{ importMsg }}
        </div>
      </div>
    </div>
  </div>
</template>
