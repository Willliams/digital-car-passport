import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as auth from '@/services/auth'

export const useAppStore = defineStore('app', () => {
  const isUnlocked = ref(auth.isUnlocked())
  const masterKey = ref(auth.getMasterKey())
  const ownerId = ref(auth.getOwnerId())

  function unlock(key: string, id: string) {
    auth.unlock(key, id)
    isUnlocked.value = true
    masterKey.value = key
    ownerId.value = id
  }

  function lock() {
    auth.lock()
    isUnlocked.value = false
    masterKey.value = null
    ownerId.value = null
  }

  return { isUnlocked, masterKey, ownerId, unlock, lock }
})
