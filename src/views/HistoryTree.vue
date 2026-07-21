<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { db } from '@/db'
import BaseDivider from '@/components/BaseDivider.vue'
import BaseButton from '@/components/BaseButton.vue'
import TreeItem from '@/components/TreeItem.vue'
import type { ServiceRecord } from '@/types'

interface TreeNode {
  label: string
  children?: TreeNode[]
  data?: ServiceRecord
  isYear?: boolean
  isMonth?: boolean
}

const router = useRouter()
const store = useAppStore()

const services = ref<ServiceRecord[]>([])
const expandedYears = ref<Set<string>>(new Set())
const expandedMonths = ref<Set<string>>(new Set())

const currentYear = new Date().getFullYear().toString()

const treeData = computed((): TreeNode[] => {
  const byYear: Record<string, Record<string, ServiceRecord[]>> = {}

  for (const s of services.value) {
    const d = new Date(s.date + 'T00:00:00')
    const year = d.getFullYear().toString()
    const month = d.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })

    if (!byYear[year]) byYear[year] = {}
    if (!byYear[year][month]) byYear[year][month] = []
    byYear[year][month].push(s)
  }

  const years = Object.keys(byYear).sort().reverse()

  return years.map(year => ({
    label: year,
    isYear: true,
    children: Object.keys(byYear[year]).map(month => ({
      label: month,
      isMonth: true,
      children: byYear[year][month].map(s => ({
        label: s.serviceName,
        data: s
      }))
    }))
  }))
})

function expandAll() {
  treeData.value.forEach(year => {
    expandedYears.value.add(year.label)
    year.children?.forEach(month => {
      expandedMonths.value.add(`${year.label}-${month.label}`)
    })
  })
}

function collapseAll() {
  expandedYears.value.clear()
  expandedMonths.value.clear()
}

function exportData() {
  const data = services.value.map(s => ({
    date: s.date,
    service: s.serviceName,
    works: s.works.map(w => w.name).join(', '),
    total: s.totalCost,
    status: s.status
  }))

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `history-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  if (!store.ownerId) {
    router.push('/create')
    return
  }

  const cars = await db.cars.where('ownerId').equals(store.ownerId).toArray()
  if (cars.length) {
    services.value = await db.services
      .where('carId')
      .equals(cars[0].id)
      .toArray()

    // Expand current year and month by default
    expandedYears.value.add(currentYear)
    const now = new Date()
    const cm = now.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })
    expandedMonths.value.add(`${currentYear}-${cm}`)
  }
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
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <h1 class="text-xl font-bold tracking-wider" style="text-transform: uppercase">
          ИСТОРИЯ ОБСЛУЖИВАНИЯ
        </h1>
      </div>
    </div>

    <BaseDivider />

    <!-- Tree -->
    <div v-if="treeData.length" class="mb-6">
      <TreeItem
        v-for="(yearNode, i) in treeData"
        :key="i"
        :node="yearNode"
        :depth="0"
      />
    </div>

    <div v-else class="text-center py-8">
      <div class="text-sm" style="color: #666">Нет записей об обслуживании</div>
    </div>

    <BaseDivider />

    <!-- Actions -->
    <div class="flex gap-3 mb-6">
      <BaseButton
        label="СВЕРНУТЬ ВСЁ"
        variant="secondary"
        size="md"
        @click="collapseAll"
      />
      <BaseButton
        label="РАЗВЕРНУТЬ ВСЁ"
        variant="secondary"
        size="md"
        @click="expandAll"
      />
      <BaseButton
        label="ЭКСПОРТ"
        variant="secondary"
        size="md"
        @click="exportData"
      />
    </div>

    <!-- Footer -->
    <div class="text-center text-xs" style="color: #999">
      Данные зашифрованы
    </div>
  </div>
</template>
