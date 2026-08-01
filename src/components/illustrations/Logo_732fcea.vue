<script setup lang="ts">
interface Props {
  size?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  size: 120,
})

const dim = typeof props.size === 'number' ? `${props.size}px` : props.size
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    :width="dim"
    :height="dim"
    fill="none"
    class="assetnode-logo"
    aria-label="AssetNode logo"
    role="img"
  >
    <rect x="15" y="20" width="90" height="75" rx="8" fill="currentColor" opacity="0.3" />

    <rect x="15" y="15" width="90" height="75" rx="8" fill="currentColor" />

    <rect x="23" y="23" width="74" height="59" rx="4" fill="var(--an-bg-base, #0f172a)" opacity="0.5" />

    <rect x="27" y="27" width="66" height="51" rx="2" fill="#0f172a" />

    <path d="M 27 27 L 93 27 L 93 35 L 27 50 Z" fill="#ffffff" opacity="0.05" />



    <path d="M 36 43 L 42 48 L 36 53" stroke="#10b981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />

    <circle cx="50" cy="45" r="2.5" fill="#10b981" />
    <circle cx="50" cy="53" r="2.5" fill="#10b981" />

    <rect x="56" y="55" width="8" height="4" fill="#10b981" rx="1" />

    <path d="M 72 40 C 68 40 68 44 68 46 C 68 48 64 49 64 49 C 64 49 68 50 68 52 C 68 54 68 58 72 58" stroke="#10b981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />

    <path d="M 45 90 L 75 90 L 80 105 L 40 105 Z" fill="currentColor" opacity="0.7" />

    <rect x="35" y="105" width="50" height="6" rx="2" fill="currentColor" />

    <rect x="23" y="75" width="6" height="2" rx="1" fill="var(--an-bg-base, #0f172a)" opacity="0.5" />
    <rect x="23" y="80" width="6" height="2" rx="1" fill="var(--an-bg-base, #0f172a)" opacity="0.5" />
  </svg>
</template>

<style scoped>
.assetnode-logo {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
</style>
