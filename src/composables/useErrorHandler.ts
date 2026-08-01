import { ref } from 'vue'


export interface AppError {
  id: string
  message: string
  severity: 'error' | 'warn' | 'info'
  timestamp: number
}

const errors = ref<AppError[]>([])
let counter = 0

export function useErrorHandler() {
  function addError(message: string, severity: AppError['severity'] = 'error') {
    const err: AppError = {
      id: `err-${++counter}`,
      message,
      severity,
      timestamp: Date.now()
    }
    errors.value.push(err)

    setTimeout(() => {
      removeError(err.id)
    }, 8000)
  }

  function removeError(id: string) {
    errors.value = errors.value.filter(e => e.id !== id)
  }

  function clearAll() {
    errors.value = []
  }

  return {
    errors,
    addError,
    removeError,
    clearAll
  }
}
