<script setup lang="ts">
import { ref } from 'vue'
import StatusStamp from './StatusStamp.vue'
import type { ServiceRecord } from '@/types'

interface TreeNode {
  label: string
  children?: TreeNode[]
  data?: ServiceRecord
  isYear?: boolean
  isMonth?: boolean
}

interface Props {
  node: TreeNode
  depth?: number
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0
})

const expanded = ref(props.node.isYear || props.node.isMonth || false)

function toggle() {
  if (props.node.children?.length) {
    expanded.value = !expanded.value
  }
}

function formatDate(d: string): string {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function formatPrice(p: number): string {
  return new Intl.NumberFormat('ru-RU').format(p) + ' ₽'
}

function formatMileage(m: number): string {
  return new Intl.NumberFormat('ru-RU').format(m)
}
</script>

<template>
  <div>
    <div
      class="flex items-center gap-2 py-2 cursor-pointer select-none"
      :style="{ paddingLeft: depth * 20 + 'px' }"
      @click="toggle"
    >
      <span
        v-if="node.children?.length"
        class="text-xs"
        style="color: #666"
      >
        {{ expanded ? '\u25BC' : '\u25B6' }}
      </span>
      <span v-else class="text-xs" style="color: #999">-</span>
      <span
        class="text-sm font-bold"
        :class="node.isYear ? 'text-lg' : ''"
      >
        {{ node.label }}
      </span>
    </div>

    <div v-if="expanded && node.children">
      <TreeItem
        v-for="(child, i) in node.children"
        :key="i"
        :node="child"
        :depth="depth + 1"
      />
    </div>

    <div
      v-if="expanded && node.data"
      class="py-3 border-b border-dashed"
      style="border-color: #999; margin-left: 40px"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1">
          <div class="text-sm" style="color: #666">{{ formatDate(node.data.date) }} — {{ node.data.serviceName }}</div>
          <div class="text-sm mt-1">
            <span v-for="(work, i) in node.data.works" :key="i">
              {{ work.name }}<span v-if="i < node.data!.works.length - 1">, </span>
            </span>
          </div>
          <div class="text-xs mt-1" style="color: #666">
            {{ formatMileage(node.data.mileage) }} км
          </div>
        </div>
        <div class="text-right">
          <div class="text-sm font-bold">{{ formatPrice(node.data.totalCost) }}</div>
          <StatusStamp :status="node.data.status" size="sm" />
        </div>
      </div>
    </div>
  </div>
</template>
