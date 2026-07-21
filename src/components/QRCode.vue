<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import QRCode from 'qrcode'

interface Props {
  value: string
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 250
})

const canvasRef = ref<HTMLCanvasElement>()

async function generateQR() {
  if (!canvasRef.value || !props.value) return
  await QRCode.toCanvas(canvasRef.value, props.value, {
    width: props.size,
    margin: 2,
    color: {
      dark: '#2A2A2A',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M'
  })
}

watch(() => props.value, generateQR)
onMounted(generateQR)
</script>

<template>
  <div class="flex justify-center">
    <canvas ref="canvasRef" :width="size" :height="size" />
  </div>
</template>
