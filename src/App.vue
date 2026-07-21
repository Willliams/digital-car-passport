<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { computed, onMounted } from 'vue'

const router = useRouter()
const store = useAppStore()

onMounted(() => {
  const route = router.currentRoute.value.name
  if (!store.isUnlocked && route !== 'login') {
    router.push('/login')
  }
})
</script>

<template>
  <div class="min-h-screen flex items-start justify-center px-4 py-8 lg:py-16">
    <div class="w-full max-w-[480px]">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </div>
</template>
