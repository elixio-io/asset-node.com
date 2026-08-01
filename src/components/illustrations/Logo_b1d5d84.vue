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
        <stop offset="0%" stop-color="#60a5fa" />
        <stop offset="50%" stop-color="#3b82f6" />
        <stop offset="100%" stop-color="#1d4ed8" />
      </linearGradient>

      <linearGradient id="hair" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#78350f" />
        <stop offset="100%" stop-color="#451a03" />
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
      <text x="215" y="55" font-family="monospace" font-size="16" fill="#10b981" font-weight="bold" letter-spacing="-0.5">{ITAM?}</text>
      <text x="215" y="85" font-family="monospace" font-size="14" fill="#10b981" font-weight="bold" letter-spacing="-0.5">-&gt; {Asset::Node}</text>
    </g>
    <text x="215" y="55" font-family="monospace" font-size="16" fill="#ecfdf5" font-weight="bold" letter-spacing="-0.5">{ITAM?}</text>
    <text x="215" y="85" font-family="monospace" font-size="14" fill="#ecfdf5" font-weight="bold" letter-spacing="-0.5">-&gt; {Asset::Node}</text>


    <path d="M 10 200 C 10 100, 190 100, 190 200 Z" fill="url(#shirt)" filter="url(#drop-shadow)" />

    <path d="M 140 140 L 140 170 C 140 175, 160 175, 160 170 L 160 140 Z" fill="#1e3a8a" opacity="0.5" />
    <rect x="145" y="125" width="4" height="20" rx="2" fill="#f8fafc" />
    <rect x="152" y="128" width="4" height="17" rx="2" fill="#ef4444" />

    <path d="M 70 120 L 100 170 L 130 120" fill="none" stroke="#f8fafc" stroke-width="4" opacity="0.8" />
    <rect x="85" y="170" width="30" height="20" rx="2" fill="#e2e8f0" filter="url(#drop-shadow)" />
    <rect x="88" y="173" width="10" height="10" fill="#94a3b8" />
    <rect x="102" y="175" width="10" height="3" fill="#64748b" />
    <rect x="102" y="180" width="8" height="3" fill="#64748b" />

    <path d="M 70 130 L 100 150 L 130 130 L 110 110 L 90 110 Z" fill="#1e3a8a" />

    <rect x="85" y="90" width="30" height="25" fill="url(#skin-shadow)" />

    <circle cx="50" cy="70" r="12" fill="url(#skin-shadow)" />
    <circle cx="150" cy="70" r="12" fill="url(#skin-shadow)" />

    <ellipse cx="100" cy="65" rx="45" ry="55" fill="url(#skin-peach)" filter="url(#drop-shadow)" />

    <path d="M 50 65 C 50 -10, 150 -10, 150 65 C 150 40, 130 20, 100 20 C 70 20, 50 40, 50 65 Z" fill="url(#hair)" />
    <path d="M 50 45 Q 75 25 85 45 Q 110 20 125 40 Q 145 30 150 55" fill="url(#hair)" opacity="0.9" />
    <rect x="47" y="55" width="10" height="25" fill="url(#hair)" rx="5" />
    <rect x="143" y="55" width="10" height="25" fill="url(#hair)" rx="5" />

    <rect x="60" y="55" width="36" height="22" rx="4" fill="#f8fafc" stroke="#0f172a" stroke-width="5" opacity="0.9" />
    <rect x="104" y="55" width="36" height="22" rx="4" fill="#f8fafc" stroke="#0f172a" stroke-width="5" opacity="0.9" />
    <polygon points="65,58 75,58 65,70" fill="#ffffff" opacity="0.4" />
    <polygon points="109,58 119,58 109,70" fill="#ffffff" opacity="0.4" />
    <line x1="96" y1="66" x2="104" y2="66" stroke="#0f172a" stroke-width="5" />
    <line x1="50" y1="66" x2="60" y2="66" stroke="#0f172a" stroke-width="5" />
    <line x1="140" y1="66" x2="150" y2="66" stroke="#0f172a" stroke-width="5" />

    <circle cx="78" cy="66" r="5" fill="#0f172a" />
    <circle cx="122" cy="66" r="5" fill="#0f172a" />
    <circle cx="80" cy="64" r="2" fill="#ffffff" />
    <circle cx="124" cy="64" r="2" fill="#ffffff" />

    <path d="M 75 90 Q 100 80, 125 90 Q 100 100, 75 90 Z" fill="url(#hair)" />
    <path d="M 85 105 Q 100 115, 115 105 Q 100 100, 85 105 Z" fill="url(#hair)" />

    <path d="M 85 96 Q 100 105, 115 96 Z" fill="#ffffff" stroke="#0f172a" stroke-width="2" />



    <path d="M 45 75 C 45 10, 155 10, 155 75" fill="none" stroke="#1e293b" stroke-width="8" />
    <path d="M 45 75 C 45 10, 155 10, 155 75" fill="none" stroke="#334155" stroke-width="4" />
    <rect x="35" y="55" width="20" height="40" rx="8" fill="#0f172a" />
    <rect x="145" y="55" width="20" height="40" rx="8" fill="#0f172a" />
    <rect x="32" y="60" width="5" height="30" rx="2" fill="#ef4444" />
    <rect x="163" y="60" width="5" height="30" rx="2" fill="#ef4444" />

    <path d="M 155 85 Q 145 110, 120 108" fill="none" stroke="#1e293b" stroke-width="4" />
    <rect x="110" y="104" width="10" height="8" rx="4" fill="#cbd5e1" />
    <circle cx="112" cy="108" r="2" fill="#ef4444" filter="url(#glow)" />




    <path d="M 130 150 L 160 175" stroke="url(#shirt)" stroke-width="30" stroke-linecap="round" filter="url(#drop-shadow)" />
    <path d="M 155 170 L 210 145" stroke="url(#skin-peach)" stroke-width="20" stroke-linecap="round" filter="url(#drop-shadow)" />



    <path d="M 205 140 C 205 130, 220 130, 220 145 C 220 155, 210 155, 205 145 Z" fill="url(#skin-peach)" />
    <path d="M 208 135 L 205 122" stroke="url(#skin-peach)" stroke-width="6" stroke-linecap="round" />
    <path d="M 215 135 L 227 125" stroke="url(#skin-peach)" stroke-width="6" stroke-linecap="round" />
    <path d="M 217 138 L 233 130" stroke="url(#skin-peach)" stroke-width="6" stroke-linecap="round" />
    <path d="M 219 142 L 233 137" stroke="url(#skin-peach)" stroke-width="6" stroke-linecap="round" />
    <path d="M 219 146 L 229 143" stroke="url(#skin-peach)" stroke-width="5" stroke-linecap="round" />

  </svg>
</template>

<style scoped>
.assetnode-logo {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
</style>
