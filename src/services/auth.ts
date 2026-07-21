const AUTH_KEY = 'car-passport-auth'

export interface AuthState {
  isUnlocked: boolean
  masterKey: string | null
  ownerId: string | null
}

function loadState(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { isUnlocked: false, masterKey: null, ownerId: null }
}

function saveState(state: AuthState): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(state))
}

let state = loadState()

export function getAuthState(): AuthState {
  return state
}

export function isUnlocked(): boolean {
  return state.isUnlocked
}

export function getMasterKey(): string | null {
  return state.masterKey
}

export function unlock(masterKey: string, ownerId: string): void {
  state = { isUnlocked: true, masterKey, ownerId }
  saveState(state)
}

export function lock(): void {
  state = { isUnlocked: false, masterKey: null, ownerId: null }
  saveState(state)
}

export function getOwnerId(): string | null {
  return state.ownerId
}
