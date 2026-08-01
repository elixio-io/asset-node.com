import { defineStore } from 'pinia'
import api from '../lib/api'

interface AILogEntry {
  id: string
  _id?: string
  timestamp: Date
  prompt: string
  rawResponse: string
  parsedResponse: {
    price: number
    source: string
    url: string
  }[]
  hardware: {
    manufacturer: string
    model: string
    category?: string
  }
}

export const useAILogsStore = defineStore('aiLogs', {
  state: () => ({
    logs: [] as AILogEntry[],
    loading: false,
    error: null as string | null
  }),

  actions: {
    async fetchLogs() {
      this.loading = true
      this.error = null
      try {
        const res = await api.get('/ai-logs')
        this.logs = (Array.isArray(res.data) ? res.data : []).map((log: any) => ({
          ...log,
          id: log._id || log.id
        }))
      } catch {
        this.error = 'Failed to load AI logs'
        console.warn('[AILogs] Failed to fetch logs from backend')
      } finally {
        this.loading = false
      }
    },

    addLog(
      prompt: string,
      rawResponse: string,
      parsedResponse: { price: number; source: string; url: string }[],
      hardware: { manufacturer: string; model: string; category?: string }
    ) {
      this.logs.unshift({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        prompt,
        rawResponse,
        parsedResponse,
        hardware
      })
    }
  }
})
