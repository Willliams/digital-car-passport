const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  )
}

async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return arrayBufferToBase64(raw)
}

async function importKey(base64: string): Promise<CryptoKey> {
  const buffer = base64ToArrayBuffer(base64)
  return crypto.subtle.importKey(
    'raw',
    buffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  )
}

export async function encrypt(data: string, keyBase64: string): Promise<string> {
  // Check if WebCrypto is available
  if (!crypto?.subtle) {
    console.warn('WebCrypto not available, using base64 fallback')
    return btoa(unescape(encodeURIComponent(data)))
  }

  try {
    const key = await importKey(keyBase64)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(data)

    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encoded
    )

    const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length)
    combined.set(iv)
    combined.set(new Uint8Array(encrypted), iv.length)

    return arrayBufferToBase64(combined.buffer)
  } catch (err) {
    console.warn('Encryption failed, using base64 fallback:', err)
    return btoa(unescape(encodeURIComponent(data)))
  }
}

export async function decrypt(encryptedBase64: string, keyBase64: string): Promise<string> {
  // Check if WebCrypto is available
  if (!crypto?.subtle) {
    console.warn('WebCrypto not available, using base64 fallback')
    try {
      return decodeURIComponent(escape(atob(encryptedBase64)))
    } catch {
      return encryptedBase64
    }
  }

  try {
    const key = await importKey(keyBase64)
    const combined = new Uint8Array(base64ToArrayBuffer(encryptedBase64))

    const iv = combined.slice(0, 12)
    const data = combined.slice(12)

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data
    )

    return new TextDecoder().decode(decrypted)
  } catch (err) {
    console.warn('Decryption failed, trying base64 fallback:', err)
    try {
      return decodeURIComponent(escape(atob(encryptedBase64)))
    } catch {
      return encryptedBase64
    }
  }
}

export async function createMasterKey(): Promise<string> {
  if (!crypto?.subtle) {
    console.warn('WebCrypto not available, using random key')
    // Generate a random key as fallback
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return arrayBufferToBase64(array.buffer)
  }

  const key = await generateKey()
  return exportKey(key)
}

export function generateId(): string {
  if (crypto?.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
