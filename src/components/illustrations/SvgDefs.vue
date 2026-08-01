<script setup lang="ts">











</script>

<template>
  <defs>
    <linearGradient id="mon-body" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1" />
      <stop offset="100%" stop-color="#94a3b8" />
    </linearGradient>

    <linearGradient id="mon-dark" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#475569" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>

    <radialGradient id="screen-glow" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>

    <linearGradient id="skin-peach" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffedd5" />
      <stop offset="100%" stop-color="#fdba74" />
    </linearGradient>

    <linearGradient id="skin-shadow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fdba74" />
      <stop offset="100%" stop-color="#ea580c" />
    </linearGradient>

    <linearGradient id="shirt" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>

    <linearGradient id="hair" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#292524" />
      <stop offset="100%" stop-color="#0c0a09" />
    </linearGradient>

    <linearGradient id="screen-glare" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12" />
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.0" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04" />
    </linearGradient>

    <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#020617" flood-opacity="0.4" />
    </filter>

    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
</template>
