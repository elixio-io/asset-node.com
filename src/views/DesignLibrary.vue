<script setup lang="ts">
import { ref, computed, type Component, markRaw } from 'vue'

import DynamicLogo from '../components/illustrations/DynamicLogo.vue'
import Logo527ec85 from '../components/illustrations/Logo_527ec85.vue'
import Logo5d65048 from '../components/illustrations/Logo_5d65048.vue'
import Logob1d5d84 from '../components/illustrations/Logo_b1d5d84.vue'

type TabKey = 'general' | 'character' | 'accessories' | 'environment'

interface HistoricalLogo {
  component: Component
  name: string
  title: string
  description: string
}

interface ToggleOption {
  key: string
  model: ReturnType<typeof ref<boolean>>
  label: string
}

const size = ref(160)
const textLine1 = ref('{ITAM?}')
const textLine2 = ref('-> {Asset::Node}')
const animated = ref(true)
const typingSpeed = ref(100)
const showHat = ref(true)
const showHeadphones = ref(false)
const showGlasses = ref(true)
const glassesStyle = ref<'nerdy' | 'cool'>('cool')
const showChain = ref(true)
const showWatch = ref(true)
const displayObject = ref<'monitor' | 'whiteboard'>('monitor')
const characterAnimation = ref<'none' | 'floating' | 'waving'>('none')
const hairStyle = ref<'short' | 'bald' | 'curly' | 'long'>('short')
const activeTab = ref<TabKey>('general')

const tabs: { key: TabKey; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'character', label: 'Character' },
  { key: 'accessories', label: 'Accessories' },
  { key: 'environment', label: 'Environment' },
]

const accessoryToggles: ToggleOption[] = [
  { key: 'hat', model: showHat, label: 'Snapback Hat' },
  { key: 'headphones', model: showHeadphones, label: 'Headphones' },
  { key: 'chain', model: showChain, label: 'Gold Chain' },
  { key: 'watch', model: showWatch, label: 'Gold Watch' },
]

const historicalLogos: HistoricalLogo[] = [
  { component: markRaw(DynamicLogo), name: 'DynamicLogo', title: 'Current Evolution', description: 'The "Stylish Nerd" — fully configurable with backwards snapback, gold chain, watch, and synthwave glasses.' },
  { component: markRaw(Logob1d5d84), name: 'Logo_b1d5d84', title: 'Classic Favicon', description: 'The foundational design used as the current browser tab favicon.' },
  { component: markRaw(Logo5d65048), name: 'Logo_5d65048', title: 'Mid-stage Iteration', description: 'Commit 5d65048 representation.' },
  { component: markRaw(Logo527ec85), name: 'Logo_527ec85', title: 'Initial Design', description: 'Commit 527ec85 representation.' },
]

const textLines = computed(() => {
  return [textLine1.value, textLine2.value].filter(line => line.trim() !== '')
})

const generatedCode = computed(() => {
  const parts: string[] = ['<DynamicLogo']

  if (size.value !== 160) parts.push(`  :size="${size.value}"`)

  const defaultTextLines = ['{ITAM?}', '-> {Asset::Node}']
  if (JSON.stringify(textLines.value) !== JSON.stringify(defaultTextLines)) {
    parts.push(`  :textLines="['${textLines.value.join("', '")}']"`)
  }

  if (!animated.value) parts.push('  :animated="false"')
  if (typingSpeed.value !== 100) parts.push(`  :typingSpeed="${typingSpeed.value}"`)
  if (!showHat.value) parts.push('  :showHat="false"')
  if (showHeadphones.value) parts.push('  :showHeadphones="true"')
  if (!showGlasses.value) parts.push('  :showGlasses="false"')
  if (glassesStyle.value !== 'cool' && showGlasses.value) parts.push(`  glassesStyle="${glassesStyle.value}"`)
  if (!showChain.value) parts.push('  :showChain="false"')
  if (!showWatch.value) parts.push('  :showWatch="false"')
  if (displayObject.value !== 'monitor') parts.push(`  displayObject="${displayObject.value}"`)
  if (characterAnimation.value !== 'none') parts.push(`  characterAnimation="${characterAnimation.value}"`)
  if (hairStyle.value !== 'short') parts.push(`  hairStyle="${hairStyle.value}"`)

  parts.push('/>')
  return parts.join('\n')
})

const copyFeedback = ref('')
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

const showFeedback = (msg: string) => {
  copyFeedback.value = msg
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => { copyFeedback.value = '' }, 2000)
}

const copyToClipboard = () => {
  navigator.clipboard.writeText(generatedCode.value)
  showFeedback('Snippet copied!')
}
const copyHistoricalSnippet = (name: string) => {
  navigator.clipboard.writeText(`<${name} size="160" />`)
  showFeedback(`<${name} /> copied!`)
}
</script>

<template>
  <div class="design-library-container p-6 bg-slate-900 min-h-screen text-slate-200">
    <h1 class="text-3xl font-bold mb-8 text-slate-100">🎨 SVG Design Library</h1>

    <Transition name="toast">
      <div v-if="copyFeedback" class="copy-toast">✓ {{ copyFeedback }}</div>
    </Transition>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">

      <section class="card">
        <h2 class="text-2xl font-semibold mb-6 flex items-center gap-2 text-slate-100">
          <span class="text-indigo-400">⚙️</span> Dynamic Playground
        </h2>

        <div class="flex flex-col gap-8">
          <div class="preview-area">
            <div class="min-w-fit min-h-fit flex justify-center items-center p-4">
              <DynamicLogo
                :size="size" :textLines="textLines" :animated="animated" :typingSpeed="typingSpeed"
                :showHat="showHat" :showHeadphones="showHeadphones" :showGlasses="showGlasses"
                :glassesStyle="glassesStyle" :showChain="showChain" :showWatch="showWatch"
                :displayObject="displayObject" :characterAnimation="characterAnimation" :hairStyle="hairStyle"
              />
            </div>
          </div>

          <div class="space-y-4">
            <div class="flex space-x-1 bg-slate-900/80 p-1 rounded-lg border border-slate-700/50 mb-4 overflow-x-auto custom-scrollbar">
              <button
                v-for="tab in tabs" :key="tab.key"
                @click="activeTab = tab.key"
                :class="['tab-btn', activeTab === tab.key && 'tab-btn--active']"
              >{{ tab.label }}</button>
            </div>

            <div v-show="activeTab === 'general'" class="tab-content space-y-4">
              <div>
                <label class="field-label">Scale (px)</label>
                <input type="number" v-model.number="size" min="80" max="1000" class="field-input">
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="field-label">Text Line 1</label>
                  <input type="text" v-model="textLine1" class="field-input">
                </div>
                <div>
                  <label class="field-label">Text Line 2</label>
                  <input type="text" v-model="textLine2" class="field-input">
                </div>
              </div>
              <div class="control-group">
                <div class="toggle-row" @click="animated = !animated">
                  <input type="checkbox" v-model="animated" class="field-checkbox">
                  <span class="toggle-label">Typewriter Animation</span>
                </div>
                <div v-if="animated" class="pl-7 pt-1 animate-in fade-in duration-200">
                  <label class="block text-sm text-slate-400 mb-2">Typing Speed ({{ typingSpeed }}ms)</label>
                  <input type="range" v-model.number="typingSpeed" min="20" max="500" step="10" class="w-full accent-indigo-500 cursor-pointer">
                </div>
              </div>
            </div>

            <div v-show="activeTab === 'character'" class="tab-content space-y-4">
              <div>
                <label class="field-label">Hair Style</label>
                <select v-model="hairStyle" class="field-select">
                  <option value="short">Short (Default)</option>
                  <option value="bald">Bald</option>
                  <option value="curly">Curly</option>
                  <option value="long">Long</option>
                </select>
              </div>
              <div>
                <label class="field-label">Character Animation</label>
                <select v-model="characterAnimation" class="field-select">
                  <option value="none">None</option>
                  <option value="floating">Floating</option>
                  <option value="waving">Waving</option>
                </select>
              </div>
            </div>

            <div v-show="activeTab === 'accessories'" class="tab-content space-y-4">
              <div class="grid grid-cols-2 gap-3 control-group">
                <div v-for="toggle in accessoryToggles" :key="toggle.key" class="toggle-row" @click="toggle.model.value = !toggle.model.value">
                  <input type="checkbox" :id="toggle.key" v-model="toggle.model.value" class="field-checkbox">
                  <label :for="toggle.key" class="toggle-label">{{ toggle.label }}</label>
                </div>
              </div>
              <div class="control-group">
                <div class="toggle-row" @click="showGlasses = !showGlasses">
                  <input type="checkbox" id="glasses" v-model="showGlasses" class="field-checkbox">
                  <span class="toggle-label">Glasses</span>
                </div>
                <div v-if="showGlasses" class="pl-7 pt-1 animate-in fade-in duration-200">
                  <label class="block text-sm text-slate-400 mb-1">Glasses Style</label>
                  <select v-model="glassesStyle" class="field-select">
                    <option value="cool">Synthwave Cool</option>
                    <option value="nerdy">Classic Nerdy</option>
                  </select>
                </div>
              </div>
            </div>

            <div v-show="activeTab === 'environment'" class="tab-content space-y-4">
              <div>
                <label class="field-label">Display Object</label>
                <select v-model="displayObject" class="field-select">
                  <option value="monitor">Computer Monitor</option>
                  <option value="whiteboard">Whiteboard</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Generated Code</h3>
            <button @click="copyToClipboard" class="copy-btn">Copy Snippet</button>
          </div>
          <pre class="bg-slate-950 text-indigo-300 p-4 rounded-lg text-sm font-mono overflow-x-auto border border-slate-800"><code>{{ generatedCode }}</code></pre>
        </div>
      </section>

      <section class="card">
        <h2 class="text-2xl font-semibold mb-6 flex items-center gap-2 text-slate-100">
          <span class="text-slate-400">🏛️</span> Historical Archive
        </h2>

        <div class="space-y-6 overflow-y-auto max-h-[800px] pr-2 custom-scrollbar">
          <div
            v-for="logo in historicalLogos" :key="logo.name"
            class="p-4 border border-slate-700 rounded-xl bg-slate-900/50 flex items-center gap-6 relative group hover:border-slate-600 transition-colors"
          >
            <div class="w-48 flex-shrink-0 bg-slate-950 rounded-lg p-4 flex justify-center shadow-inner border border-slate-800">
              <component :is="logo.component" size="120" />
            </div>
            <div class="flex-grow">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="font-semibold text-lg text-slate-200">{{ logo.title }}</h3>
                  <code class="text-xs bg-slate-800 border border-slate-700 px-2 py-1 rounded mt-1 inline-block text-slate-300">{{ logo.name }}.vue</code>
                </div>
                <button @click="copyHistoricalSnippet(logo.name)" class="copy-btn opacity-0 group-hover:opacity-100 transition-opacity">
                  Copy Component
                </button>
              </div>
              <p class="text-sm text-slate-400 mt-2">{{ logo.description }}</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>

<style scoped>
.card {
  background-color: rgb(30 41 59);
  padding: 1.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  border: 1px solid rgb(51 65 85);
}

.preview-area {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgb(2 6 23);
  border-radius: 0.75rem;
  padding: 1rem;
  box-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);
  height: 380px;
  position: relative;
  overflow: auto;
  border: 1px solid rgb(30 41 59);
}

.tab-btn {
  white-space: nowrap;
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
  color: rgb(148 163 184);
}
.tab-btn:hover { color: rgb(226 232 240); background-color: rgb(30 41 59); }
.tab-btn--active {
  background-color: rgb(99 102 241 / 0.2);
  color: rgb(165 180 252);
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  border: 1px solid rgb(99 102 241 / 0.3);
}

.tab-content { animation: fadeSlideIn 0.3s ease; }
@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

.field-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(203 213 225);
  margin-bottom: 0.25rem;
}

.field-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background-color: rgb(15 23 42);
  border: 1px solid rgb(51 65 85);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: rgb(226 232 240);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.field-input:focus { border-color: rgb(99 102 241); box-shadow: 0 0 0 1px rgb(99 102 241); outline: none; }

.field-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background-color: rgb(15 23 42);
  border: 1px solid rgb(51 65 85);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: rgb(226 232 240);
  cursor: pointer;
  appearance: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.field-select:focus { border-color: rgb(99 102 241); box-shadow: 0 0 0 1px rgb(99 102 241); outline: none; }

.field-checkbox {
  border-radius: 0.25rem;
  background-color: rgb(15 23 42);
  border-color: rgb(71 85 105);
  color: rgb(99 102 241);
  cursor: pointer;
  width: 1rem;
  height: 1rem;
}

.control-group {
  padding: 0.75rem 1rem;
  background-color: rgb(15 23 42 / 0.5);
  border-radius: 0.5rem;
  border: 1px solid rgb(51 65 85 / 0.5);
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.toggle-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(203 213 225);
  cursor: pointer;
  user-select: none;
}

.copy-btn {
  font-size: 0.75rem;
  background-color: rgb(99 102 241 / 0.2);
  color: rgb(165 180 252);
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-weight: 500;
  transition: background-color 0.15s, color 0.15s;
  border: 1px solid rgb(99 102 241 / 0.3);
}
.copy-btn:hover { background-color: rgb(99 102 241 / 0.3); color: rgb(199 210 254); }

.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 20px; }

.copy-toast {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  background-color: rgb(16 185 129);
  color: #fff;
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.3);
  z-index: 50;
}
.toast-enter-active { animation: toastIn 0.3s ease; }
.toast-leave-active { animation: toastIn 0.2s ease reverse; }
@keyframes toastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
</style>
