<script setup lang="ts">
interface Props {
  label: string
  type?: string
  modelValue: string | number | null
  mask?: boolean
  error?: string
  hint?: string
  placeholder?: string
  required?: boolean
  uppercase?: boolean
  min?: number
  max?: number
  step?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  required: false,
  uppercase: false,
  mask: false
})

const emit = defineEmits<{ 'update:modelValue': [value: string | number | null] }>()

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement
  let value: string | number | null = target.value

  if (props.type === 'number') {
    value = target.value === '' ? null : Number(target.value)
  }

  if (props.uppercase && typeof value === 'string') {
    value = value.toUpperCase()
  }

  if (props.mask && typeof value === 'string') {
    value = applyPhoneMask(value)
  }

  emit('update:modelValue', value)
}

function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''

  let formatted = '+7'
  if (digits.length > 1) {
    const phoneDigits = digits.startsWith('7') || digits.startsWith('8') ? digits.slice(1) : digits
    if (phoneDigits.length > 0) formatted += ' (' + phoneDigits.slice(0, 3)
    if (phoneDigits.length >= 3) formatted += ') ' + phoneDigits.slice(3, 6)
    if (phoneDigits.length >= 6) formatted += '-' + phoneDigits.slice(6, 8)
    if (phoneDigits.length >= 8) formatted += '-' + phoneDigits.slice(8, 10)
  }

  return formatted
}
</script>

<template>
  <div>
    <label class="block text-xs mb-1" style="color: #666">{{ label }}</label>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :min="min"
      :max="max"
      :step="step"
      class="input-field"
      :class="{ 'border-red-500': error }"
      @input="handleInput"
    />
    <p v-if="hint" class="text-xs mt-1" style="color: #666">{{ hint }}</p>
    <p v-if="error" class="text-xs mt-1 text-red-500">{{ error }}</p>
  </div>
</template>
