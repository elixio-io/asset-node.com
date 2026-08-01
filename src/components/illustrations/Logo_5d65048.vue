<script setup lang="ts">
interface Props {
  size?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  size: 160,
})

const dim = typeof props.size === 'number' ? `${props.size}px` : props.size
const widthDim = typeof props.size === 'number' ? `${props.size * 2}px` : `calc(${props.size} * 2)`
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 400 200"
    :width="widthDim"
    :height="dim"
    fill="none"
    class="assetnode-logo"
    aria-label="AssetNode logo"
    role="img"
  >
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


    <path d="M 230 185 L 330 185 L 310 150 L 250 150 Z" fill="url(#mon-dark)" filter="url(#drop-shadow)" />
    <rect x="220" y="185" width="120" height="8" rx="4" fill="#334155" filter="url(#drop-shadow)" />
    <rect x="265" y="130" width="30" height="30" fill="#1e293b" />
    <line x1="270" y1="130" x2="270" y2="160" stroke="#0f172a" stroke-width="3" />
    <line x1="280" y1="130" x2="280" y2="160" stroke="#0f172a" stroke-width="3" />
    <line x1="290" y1="130" x2="290" y2="160" stroke="#0f172a" stroke-width="3" />

    <rect x="200" y="15" width="180" height="135" rx="12" fill="url(#mon-dark)" filter="url(#drop-shadow)" />

    <rect x="185" y="5" width="180" height="135" rx="12" fill="url(#mon-body)" />

    <rect x="195" y="15" width="160" height="115" rx="6" fill="#0f172a" />

    <rect x="200" y="20" width="150" height="105" rx="4" fill="url(#screen-glow)" />

    <path d="M 200 20 L 350 20 L 350 50 L 200 100 Z" fill="url(#screen-glare)" />

    <circle cx="310" cy="130" r="3" fill="#94a3b8" />
    <circle cx="322" cy="130" r="3" fill="#94a3b8" />
    <circle cx="334" cy="130" r="3" fill="#94a3b8" />
    <rect x="345" y="128" width="8" height="4" rx="2" fill="#10b981" filter="url(#glow)" />

    <g filter="url(#neon-glow)">
      <text x="210" y="45" font-family="monospace" font-size="12" fill="#10b981" font-weight="bold">const itam = new</text>
      <text x="225" y="65" font-family="monospace" font-size="12" fill="#10b981" font-weight="bold">AssetNode();</text>
      <text x="210" y="90" font-family="monospace" font-size="12" fill="#10b981" font-weight="bold">itam.init();</text>
    </g>
    <text x="210" y="45" font-family="monospace" font-size="12" fill="#ecfdf5" font-weight="bold">const itam = new</text>
    <text x="225" y="65" font-family="monospace" font-size="12" fill="#ecfdf5" font-weight="bold">AssetNode();</text>
    <text x="210" y="90" font-family="monospace" font-size="12" fill="#ecfdf5" font-weight="bold">itam.init();</text>


    <path d="M 35 200 C 35 120, 165 120, 165 200 Z" fill="url(#shirt)" filter="url(#drop-shadow)" />
    <path d="M 65 160 L 135 160" stroke="#f472b6" stroke-width="3" opacity="0.8" />
    <path d="M 55 175 L 145 175" stroke="#a78bfa" stroke-width="3" opacity="0.8" />
    <path d="M 45 190 L 155 190" stroke="#38bdf8" stroke-width="3" opacity="0.8" />

    <path d="M 75 125 Q 100 145 125 125 L 125 135 Q 100 155 75 135 Z" fill="#020617" />

    <rect x="85" y="90" width="30" height="35" fill="url(#skin-shadow)" />

    <circle cx="65" cy="70" r="10" fill="url(#skin-shadow)" />
    <circle cx="135" cy="70" r="10" fill="url(#skin-shadow)" />

    <ellipse cx="100" cy="65" rx="36" ry="50" fill="url(#skin-peach)" filter="url(#drop-shadow)" />

    <path d="M 62 65 C 62 -5, 138 -5, 138 65 C 138 35, 120 10, 100 10 C 80 10, 62 35, 62 65 Z" fill="url(#hair)" />
    <path d="M 62 45 Q 85 15 90 45 Q 110 10 120 40 Q 130 20 138 55" fill="url(#hair)" opacity="0.9" />
    <rect x="62" y="55" width="8" height="20" fill="url(#hair)" rx="4" />
    <rect x="130" y="55" width="8" height="20" fill="url(#hair)" rx="4" />

    <rect x="68" y="52" width="28" height="20" rx="3" fill="#f8fafc" stroke="#1c1917" stroke-width="3" opacity="0.9" />
    <rect x="104" y="52" width="28" height="20" rx="3" fill="#f8fafc" stroke="#1c1917" stroke-width="3" opacity="0.9" />
    <polygon points="72,55 80,55 72,65" fill="#ffffff" opacity="0.4" />
    <polygon points="108,55 116,55 108,65" fill="#ffffff" opacity="0.4" />
    <line x1="96" y1="62" x2="104" y2="62" stroke="#1c1917" stroke-width="3" />
    <line x1="65" y1="62" x2="68" y2="62" stroke="#1c1917" stroke-width="3" />
    <line x1="132" y1="62" x2="135" y2="62" stroke="#1c1917" stroke-width="3" />

    <circle cx="82" cy="62" r="4" fill="#0f172a" />
    <circle cx="118" cy="62" r="4" fill="#0f172a" />
    <circle cx="83" cy="60" r="1.5" fill="#ffffff" />
    <circle cx="119" cy="60" r="1.5" fill="#ffffff" />

    <path d="M 82 85 Q 100 78, 118 85 Q 100 92, 82 85 Z" fill="url(#hair)" />
    <path d="M 88 98 Q 100 108, 112 98 Q 100 94, 88 98 Z" fill="url(#hair)" />

    <path d="M 88 91 Q 100 98, 112 91 Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.5" />



    <path d="M 60 75 C 60 20, 140 20, 140 75" fill="none" stroke="#1e293b" stroke-width="8" />
    <path d="M 60 75 C 60 20, 140 20, 140 75" fill="none" stroke="#334155" stroke-width="4" />
    <rect x="52" y="55" width="16" height="35" rx="6" fill="#0f172a" />
    <rect x="132" y="55" width="16" height="35" rx="6" fill="#0f172a" />
    <rect x="50" y="60" width="4" height="25" rx="2" fill="#ef4444" />
    <rect x="146" y="60" width="4" height="25" rx="2" fill="#ef4444" />

    <path d="M 140 80 Q 130 100, 115 102" fill="none" stroke="#1e293b" stroke-width="3" />
    <rect x="105" y="99" width="10" height="6" rx="3" fill="#cbd5e1" />
    <circle cx="107" cy="102" r="2" fill="#ef4444" filter="url(#glow)" />



    <path d="M 125 140 L 145 165" stroke="url(#shirt)" stroke-width="24" stroke-linecap="round" filter="url(#drop-shadow)" />
    <path d="M 140 160 L 190 145" stroke="url(#skin-peach)" stroke-width="14" stroke-linecap="round" filter="url(#drop-shadow)" />
    <circle cx="195" cy="143" r="9" fill="url(#skin-peach)" />
    <path d="M 195 143 L 210 120" stroke="url(#skin-peach)" stroke-width="5" stroke-linecap="round" />
    <path d="M 190 135 L 195 125" stroke="url(#skin-peach)" stroke-width="4" stroke-linecap="round" />
    <path d="M 190 148 L 205 140" stroke="#d4a373" stroke-width="2.5" stroke-linecap="round" />
    <path d="M 185 152 L 200 144" stroke="#d4a373" stroke-width="2.5" stroke-linecap="round" />

  </svg>
</template>

<style scoped>
.assetnode-logo {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
</style>
