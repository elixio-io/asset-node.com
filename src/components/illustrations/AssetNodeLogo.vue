<script setup lang="ts">
import DynamicLogo from './DynamicLogo.vue'

interface Props {
  size?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  size: 160,
})
</script>

<template>
  <DynamicLogo :size="props.size" />
</template>
