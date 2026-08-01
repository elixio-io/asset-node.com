<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import SvgDefs from './SvgDefs.vue'

export interface DynamicLogoProps {
  size?: number | string
  textLines?: string[]
  animated?: boolean
  typingSpeed?: number
  showHat?: boolean
  showHeadphones?: boolean
  showGlasses?: boolean
  glassesStyle?: 'nerdy' | 'cool'
  showChain?: boolean
  showWatch?: boolean
  displayObject?: 'monitor' | 'whiteboard'
  characterAnimation?: 'none' | 'floating' | 'waving'
  hairStyle?: 'short' | 'bald' | 'curly' | 'long'
}

const props = withDefaults(defineProps<DynamicLogoProps>(), {
  size: 160,
  textLines: () => ["{ITAM?}", "-> {Asset::Node}"],
  animated: true,
  typingSpeed: 100,
  showHat: true,
  showHeadphones: false,
  showGlasses: true,
  glassesStyle: 'cool',
  showChain: true,
  showWatch: true,
  displayObject: 'monitor',
  characterAnimation: 'none',
  hairStyle: 'short',
})

const dim = computed(() => typeof props.size === 'number' ? `${props.size}px` : props.size)
const widthDim = computed(() => typeof props.size === 'number' ? `${props.size * 2}px` : `calc(${props.size} * 2)`)

const fullCode = computed(() => props.textLines.join('\n'))
const currentCode = ref('')
let intervalId: ReturnType<typeof setInterval> | null = null

const startAnimation = () => {
  if (intervalId) clearInterval(intervalId)

  if (!props.animated) {
    currentCode.value = fullCode.value
    return
  }

  let i = 0
  let forward = true
  currentCode.value = ''

  intervalId = setInterval(() => {
    const fCode = fullCode.value
    if (forward) {
      if (i < fCode.length) {
        i++
      } else {
        setTimeout(() => { if(forward) forward = false }, 2000)
      }
    } else {
      if (i > 0) {
        i--
      } else {
        forward = true
      }
    }
    currentCode.value = fCode.substring(0, i)
  }, props.typingSpeed)
}

onMounted(startAnimation)
watch([() => props.textLines, () => props.animated, () => props.typingSpeed], startAnimation, { deep: true })

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})

const codeLines = computed(() => currentCode.value.split('\n'))
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 400 200"
    :width="widthDim"
    :height="dim"
    fill="none"
    class="assetnode-logo"
    :class="{ 'anim-floating': characterAnimation === 'floating', 'anim-waving': characterAnimation === 'waving' }"
    aria-label="AssetNode logo"
    role="img"
  >
    <SvgDefs />

    <g v-if="displayObject === 'monitor'">
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
        <text x="205" y="45" font-family="monospace" font-size="11" fill="#10b981" font-weight="bold" text-anchor="start" xml:space="preserve">{{ codeLines[0] || '' }}</text>
        <text x="205" y="65" font-family="monospace" font-size="11" fill="#10b981" font-weight="bold" text-anchor="start" xml:space="preserve">{{ codeLines[1] || '' }}</text>
        <text x="205" y="85" font-family="monospace" font-size="11" fill="#10b981" font-weight="bold" text-anchor="start" xml:space="preserve">{{ codeLines[2] || '' }}</text>
        <text x="205" y="105" font-family="monospace" font-size="11" fill="#10b981" font-weight="bold" text-anchor="start" xml:space="preserve">{{ codeLines[3] || '' }}</text>
      </g>
      <text x="205" y="45" font-family="monospace" font-size="11" fill="#ecfdf5" font-weight="bold" text-anchor="start" xml:space="preserve">{{ codeLines[0] || '' }}</text>
      <text x="205" y="65" font-family="monospace" font-size="11" fill="#ecfdf5" font-weight="bold" text-anchor="start" xml:space="preserve">{{ codeLines[1] || '' }}</text>
      <text x="205" y="85" font-family="monospace" font-size="11" fill="#ecfdf5" font-weight="bold" text-anchor="start" xml:space="preserve">{{ codeLines[2] || '' }}</text>
      <text x="205" y="105" font-family="monospace" font-size="11" fill="#ecfdf5" font-weight="bold" text-anchor="start" xml:space="preserve">{{ codeLines[3] || '' }}</text>
    </g>

    <g v-else-if="displayObject === 'whiteboard'">
      <line x1="210" y1="190" x2="230" y2="150" stroke="#64748b" stroke-width="6" stroke-linecap="round" />
      <line x1="370" y1="190" x2="350" y2="150" stroke="#64748b" stroke-width="6" stroke-linecap="round" />
      <circle cx="210" cy="190" r="5" fill="#1e293b" />
      <circle cx="370" cy="190" r="5" fill="#1e293b" />
      <rect x="190" y="10" width="200" height="140" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="8" filter="url(#drop-shadow)" />
      <rect x="200" y="146" width="180" height="4" fill="#94a3b8" />
      <rect x="230" y="142" width="20" height="6" fill="#ef4444" rx="2" />
      <rect x="255" y="142" width="20" height="6" fill="#3b82f6" rx="2" />
      <rect x="280" y="138" width="30" height="8" fill="#475569" rx="2" />

      <text x="210" y="45" font-family="'Comic Sans MS', 'Marker Felt', sans-serif" font-size="13" fill="#0f172a" font-weight="bold" text-anchor="start" xml:space="preserve">{{ codeLines[0] || '' }}</text>
      <text x="210" y="65" font-family="'Comic Sans MS', 'Marker Felt', sans-serif" font-size="13" fill="#0f172a" font-weight="bold" text-anchor="start" xml:space="preserve">{{ codeLines[1] || '' }}</text>
      <text x="210" y="85" font-family="'Comic Sans MS', 'Marker Felt', sans-serif" font-size="13" fill="#ef4444" font-weight="bold" text-anchor="start" xml:space="preserve">{{ codeLines[2] || '' }}</text>
      <text x="210" y="105" font-family="'Comic Sans MS', 'Marker Felt', sans-serif" font-size="13" fill="#0f172a" font-weight="bold" text-anchor="start" xml:space="preserve">{{ codeLines[3] || '' }}</text>
    </g>

    <path d="M 35 200 C 35 120, 165 120, 165 200 Z" fill="url(#shirt)" filter="url(#drop-shadow)" />
    <path d="M 65 160 L 135 160" stroke="#f472b6" stroke-width="3" opacity="0.8" />
    <path d="M 55 175 L 145 175" stroke="#a78bfa" stroke-width="3" opacity="0.8" />
    <path d="M 45 190 L 155 190" stroke="#38bdf8" stroke-width="3" opacity="0.8" />

    <path d="M 75 125 Q 100 145 125 125 L 125 135 Q 100 155 75 135 Z" fill="#020617" />
    <rect x="85" y="90" width="30" height="35" fill="url(#skin-shadow)" />

    <g v-if="showChain">
      <path d="M 80 120 Q 100 155, 120 120" fill="none" stroke="#fbbf24" stroke-width="4" filter="url(#drop-shadow)" />
      <path d="M 80 120 Q 100 155, 120 120" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3,2" />
      <polygon points="93,142 107,142 100,152" fill="#fbbf24" filter="url(#drop-shadow)" />
    </g>

    <circle cx="65" cy="70" r="10" fill="url(#skin-shadow)" />
    <circle cx="135" cy="70" r="10" fill="url(#skin-shadow)" />

    <ellipse cx="100" cy="65" rx="36" ry="50" fill="url(#skin-peach)" filter="url(#drop-shadow)" />

    <g v-if="hairStyle !== 'bald'">
      <g v-if="hairStyle === 'short'">
        <path d="M 60 70 C 50 20, 150 20, 140 70 C 145 40, 130 10, 100 10 C 70 10, 55 40, 60 70 Z" fill="url(#hair)" />
        <rect x="62" y="55" width="8" height="25" fill="url(#hair)" rx="4" />
        <rect x="130" y="55" width="8" height="25" fill="url(#hair)" rx="4" />
      </g>

      <g v-if="hairStyle === 'curly'">
        <path d="M 60 70 Q 50 50, 65 40 Q 60 20, 80 15 Q 90 0, 110 10 Q 130 0, 140 25 Q 155 35, 145 60 Q 150 70, 140 70 C 145 40, 130 10, 100 10 C 70 10, 55 40, 60 70 Z" fill="url(#hair)" />
        <circle cx="65" cy="40" r="12" fill="url(#hair)" />
        <circle cx="80" cy="20" r="14" fill="url(#hair)" />
        <circle cx="110" cy="15" r="16" fill="url(#hair)" />
        <circle cx="140" cy="30" r="14" fill="url(#hair)" />
        <circle cx="145" cy="55" r="12" fill="url(#hair)" />
        <rect x="62" y="55" width="8" height="25" fill="url(#hair)" rx="4" />
        <rect x="130" y="55" width="8" height="25" fill="url(#hair)" rx="4" />
      </g>

      <g v-if="hairStyle === 'long'">
        <path d="M 55 60 C 40 80, 45 120, 65 130 L 100 120 L 135 130 C 155 120, 160 80, 145 60 Z" fill="url(#hair)" filter="url(#drop-shadow)" />
        <path d="M 60 70 C 50 20, 150 20, 140 70 C 145 40, 130 10, 100 10 C 70 10, 55 40, 60 70 Z" fill="url(#hair)" />
        <rect x="62" y="55" width="8" height="35" fill="url(#hair)" rx="4" />
        <rect x="130" y="55" width="8" height="35" fill="url(#hair)" rx="4" />
      </g>
    </g>

    <g v-if="showHat">
      <path d="M 90 20 C 60 20, 50 35, 50 45 L 150 45 C 150 35, 140 20, 110 20 Z" fill="#0f172a" />
      <path d="M 120 40 L 160 48 L 150 35 Z" fill="#f472b6" />
      <circle cx="100" cy="18" r="4" fill="#38bdf8" />
    </g>

    <g v-if="showHeadphones">
      <path d="M 55 75 C 55 10, 145 10, 145 75" fill="none" stroke="#1e293b" stroke-width="8" />
      <path d="M 55 75 C 55 10, 145 10, 145 75" fill="none" stroke="#334155" stroke-width="4" />
      <rect x="45" y="55" width="20" height="40" rx="8" fill="#0f172a" />
      <rect x="135" y="55" width="20" height="40" rx="8" fill="#0f172a" />
      <rect x="42" y="60" width="5" height="30" rx="2" fill="#ef4444" />
      <rect x="153" y="60" width="5" height="30" rx="2" fill="#ef4444" />
      <path d="M 145 85 Q 135 110, 120 108" fill="none" stroke="#1e293b" stroke-width="4" />
      <rect x="110" y="104" width="10" height="8" rx="4" fill="#cbd5e1" />
      <circle cx="112" cy="108" r="2" fill="#ef4444" filter="url(#glow)" />
    </g>

    <g v-if="showGlasses && glassesStyle === 'nerdy'">
      <rect x="60" y="55" width="36" height="22" rx="4" fill="#f8fafc" stroke="#0f172a" stroke-width="5" opacity="0.9" />
      <rect x="104" y="55" width="36" height="22" rx="4" fill="#f8fafc" stroke="#0f172a" stroke-width="5" opacity="0.9" />
      <polygon points="65,58 75,58 65,70" fill="#ffffff" opacity="0.4" />
      <polygon points="109,58 119,58 109,70" fill="#ffffff" opacity="0.4" />
      <line x1="96" y1="66" x2="104" y2="66" stroke="#0f172a" stroke-width="5" />
      <line x1="50" y1="66" x2="60" y2="66" stroke="#0f172a" stroke-width="5" />
      <line x1="140" y1="66" x2="150" y2="66" stroke="#0f172a" stroke-width="5" />
    </g>
    <g v-if="showGlasses && glassesStyle === 'cool'">
      <path d="M 64 45 L 94 45 L 94 70 Q 79 80, 64 70 Z" fill="#0891b2" fill-opacity="0.5" stroke="#f472b6" stroke-width="4" stroke-linejoin="round" />
      <path d="M 106 45 L 136 45 L 136 70 Q 121 80, 106 70 Z" fill="#0891b2" fill-opacity="0.5" stroke="#f472b6" stroke-width="4" stroke-linejoin="round" />
      <polygon points="68,50 85,50 75,65" fill="#ffffff" opacity="0.4" />
      <polygon points="110,50 127,50 117,65" fill="#ffffff" opacity="0.4" />
      <line x1="94" y1="50" x2="106" y2="50" stroke="#f472b6" stroke-width="4" />
      <line x1="58" y1="50" x2="64" y2="50" stroke="#f472b6" stroke-width="4" />
      <line x1="136" y1="50" x2="142" y2="50" stroke="#f472b6" stroke-width="4" />
    </g>

    <circle cx="82" cy="62" r="4" fill="#0f172a" />
    <circle cx="118" cy="62" r="4" fill="#0f172a" />
    <circle cx="83" cy="60" r="1.5" fill="#ffffff" />
    <circle cx="119" cy="60" r="1.5" fill="#ffffff" />

    <path d="M 82 85 Q 100 78, 118 85 Q 100 92, 82 85 Z" fill="url(#hair)" />
    <path d="M 88 98 Q 100 108, 112 98 Q 100 94, 88 98 Z" fill="url(#hair)" />
    <path d="M 88 91 Q 100 98, 112 91 Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.5" />

    <g class="presenting-arm">
      <path d="M 125 140 L 145 165" stroke="url(#shirt)" stroke-width="24" stroke-linecap="round" filter="url(#drop-shadow)" />
      <path d="M 140 160 L 190 145" stroke="url(#skin-peach)" stroke-width="14" stroke-linecap="round" filter="url(#drop-shadow)" />

      <g v-if="showWatch">
        <rect x="168" y="140" width="10" height="18" fill="#334155" transform="rotate(-15 173 149)" />
        <rect x="171" y="146" width="10" height="10" rx="2" fill="#fbbf24" stroke="#eab308" stroke-width="1" />
        <circle cx="176" cy="151" r="3" fill="#0f172a" />
        <line x1="174" y1="151" x2="178" y2="151" stroke="#10b981" stroke-width="1.5" />
      </g>



      <path d="M 188 141 C 188 131, 203 131, 203 146 C 203 156, 193 156, 188 146 Z" fill="url(#skin-peach)" />
      <path d="M 191 136 L 188 123" stroke="url(#skin-peach)" stroke-width="4.5" stroke-linecap="round" />
      <path d="M 198 136 L 210 126" stroke="url(#skin-peach)" stroke-width="4.5" stroke-linecap="round" />
      <path d="M 200 139 L 216 131" stroke="url(#skin-peach)" stroke-width="4.5" stroke-linecap="round" />
      <path d="M 202 143 L 216 138" stroke="url(#skin-peach)" stroke-width="4.5" stroke-linecap="round" />
      <path d="M 202 147 L 212 144" stroke="url(#skin-peach)" stroke-width="3.5" stroke-linecap="round" />
    </g>

  </svg>
</template>

<style scoped>
.assetnode-logo {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.anim-floating {
  animation: float 4s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.anim-waving .presenting-arm {
  transform-origin: 125px 140px;
  animation: wave 2.5s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-12deg); }
}
</style>
