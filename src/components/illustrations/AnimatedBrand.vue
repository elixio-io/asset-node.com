<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

export interface AnimatedBrandProps {
  states?: string[]
  speed?: number
  minWidth?: string
  animated?: boolean
}

const props = withDefaults(defineProps<AnimatedBrandProps>(), {
  states: () => [
    '{...asset, lost: true}', '{...asset, lost: true}', '{...asset, lost: true}',
    '{...asset, lost: true}', '{...asset, lost: true}', '{...asset, lost: true}',
    '{...asset, lost: true}', '{...asset, lost: true}',
    '{...asset, lost: true',
    '{...asset, lost: tru',
    '{...asset, lost: tr',
    '{...asset, lost: t',
    '{...asset, lost: ',
    '{...asset, lost:',
    '{...asset, lost',
    '{...asset, los',
    '{...asset, lo',
    '{...asset, l',
    '{...asset, ',
    '{...asset,',
    '{...asset}', '{...asset}',
    '{..asset}',
    '{.asset}',
    '{asset}', '{asset}', '{asset}',
    '{assetN}',
    '{assetNo}',
    '{assetNod}',
    '{assetNode}',
    '{assetNode}', '{assetNode}', '{assetNode}', '{assetNode}',
    '{assetNode}', '{assetNode}', '{assetNode}', '{assetNode}',
    '{assetNode}', '{assetNode}', '{assetNode}', '{assetNode}',
    '{assetNod}',
    '{assetNo}',
    '{assetN}',
    '{asset}', '{asset}', '{asset}',
    '{.asset}',
    '{..asset}',
    '{...asset}', '{...asset}',
    '{...asset,}',
    '{...asset, }',
    '{...asset, l}',
    '{...asset, lo}',
    '{...asset, los}',
    '{...asset, lost}',
    '{...asset, lost:}',
    '{...asset, lost: }',
    '{...asset, lost: t}',
    '{...asset, lost: tr}',
    '{...asset, lost: tru}',
    '{...asset, lost: true}',
  ],
  speed: 100,
  minWidth: '26ch',
  animated: true
})

const codeText = ref(props.states[0] || '')

let currentFrame = 0
let intervalId: ReturnType<typeof setInterval> | null = null

const startAnimation = () => {
  if (intervalId) clearInterval(intervalId)

  if (!props.animated || props.states.length === 0) {
    codeText.value = props.states.length > 0 ? props.states[0] : ''
    return
  }

  currentFrame = 0
  codeText.value = props.states[0]

  intervalId = setInterval(() => {
    currentFrame = (currentFrame + 1) % props.states.length
    codeText.value = props.states[currentFrame]
  }, props.speed)
}

onMounted(() => {
  startAnimation()
})

watch([() => props.states, () => props.speed, () => props.animated], () => {
  startAnimation()
}, { deep: true })

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<template>
  <span class="animated-brand" :style="{ width: props.minWidth }">{{ codeText }}</span>
</template>

<style scoped>
.animated-brand {
  display: inline-block;
  white-space: nowrap;
}
</style>
