<script setup lang="ts">
import DynamicLogo from './DynamicLogo.vue'

export interface SpeechBubbleProps {
  message: string
  characterAnimation?: 'none' | 'floating' | 'waving'
  characterSize?: number
  position?: 'left' | 'right' | 'top'
  variant?: 'tour' | 'info' | 'warning' | 'error'
  displayObject?: 'monitor' | 'whiteboard' | 'none'
  displayText?: string[]
  animateDisplay?: boolean
  showHat?: boolean
  showGlasses?: boolean
  glassesStyle?: 'nerdy' | 'cool'
  showChain?: boolean
  showWatch?: boolean
}

const props = withDefaults(defineProps<SpeechBubbleProps>(), {
  characterAnimation: 'waving',
  characterSize: 80,
  position: 'right',
  variant: 'tour',
  displayObject: 'none',
  displayText: () => [],
  animateDisplay: false,
  showHat: true,
  showGlasses: true,
  glassesStyle: 'cool',
  showChain: true,
  showWatch: true,
})

const variantColors: Record<string, string> = {
  tour: 'var(--an-primary, #6366f1)',
  info: 'var(--an-cobalt, #3b82f6)',
  warning: 'var(--an-orange, #f97316)',
  error: '#ef4444',
}
</script>

<template>
  <div
    class="speech-bubble-wrapper"
    :class="[`speech-bubble--${position}`, `speech-bubble--${variant}`]"
  >
    <div class="speech-bubble__character">
      <DynamicLogo
        :size="characterSize"
        :character-animation="characterAnimation"
        :display-object="displayObject === 'none' ? 'monitor' : displayObject"
        :text-lines="displayText.length ? displayText : ['{👋}']"
        :animated="animateDisplay"
        :show-hat="showHat"
        :show-glasses="showGlasses"
        :glasses-style="glassesStyle"
        :show-chain="showChain"
        :show-watch="showWatch"
      />
    </div>

    <div class="speech-bubble__bubble">
      <div class="speech-bubble__tail" :style="{ '--bubble-accent': variantColors[variant] }" />
      <div class="speech-bubble__content">
        <p class="speech-bubble__message">{{ message }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.speech-bubble-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  max-width: 100%;
}

.speech-bubble--left {
  flex-direction: row-reverse;
}

.speech-bubble--top {
  flex-direction: column-reverse;
  align-items: center;
}

.speech-bubble__character {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.speech-bubble__bubble {
  position: relative;
  flex: 1;
  min-width: 0;
  animation: bubble-enter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.speech-bubble__content {
  background: var(--an-surface-dark, #1e1e2e);
  border: 1px solid var(--an-border-dark, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  padding: 14px 18px;
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.speech-bubble__message {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--an-text, #e2e8f0);
}

.speech-bubble__tail {
  position: absolute;
  width: 14px;
  height: 14px;
  background: var(--an-surface-dark, #1e1e2e);
  border: 1px solid var(--an-border-dark, rgba(255, 255, 255, 0.08));
  transform: rotate(45deg);
  z-index: -1;
}

.speech-bubble--right .speech-bubble__tail {
  left: -7px;
  top: 18px;
  border-right: none;
  border-top: none;
}

.speech-bubble--left .speech-bubble__tail {
  right: -7px;
  top: 18px;
  border-left: none;
  border-bottom: none;
}

.speech-bubble--top .speech-bubble__tail {
  bottom: -7px;
  left: 50%;
  margin-left: -7px;
  border-left: none;
  border-top: none;
}

.speech-bubble__content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 12px 12px 0 0;
  background: var(--bubble-accent, var(--an-primary, #6366f1));
}

.speech-bubble--tour .speech-bubble__content::before { background: var(--an-primary, #6366f1); }
.speech-bubble--info .speech-bubble__content::before { background: var(--an-cobalt, #3b82f6); }
.speech-bubble--warning .speech-bubble__content::before { background: var(--an-orange, #f97316); }
.speech-bubble--error .speech-bubble__content::before { background: #ef4444; }

@keyframes bubble-enter {
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
