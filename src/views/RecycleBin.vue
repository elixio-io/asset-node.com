<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import api from '../lib/api'
import { useFormatters } from '../composables/useFormatters'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

import Message from 'primevue/message'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'

const { t } = useI18n()

const TYPES = ['hardware', 'peripheral', 'consumable', 'license', 'employee']
const activeTab = ref(0)
const items = ref<any>({})
const loading = ref(true)
const error = ref<string | null>(null)
const emptyDialog = ref(false)

const activeType = computed(() => TYPES[activeTab.value] || 'hardware')

async function fetchAll() {
  loading.value = true
  try { items.value = (await api.get('/recycle-bin')).data }
  catch { error.value = t('recycleBin.loadError') }
  finally { loading.value = false }
}

const currentItems = computed(() => items.value[activeType.value] || [])
const totalCount = computed(() => TYPES.reduce((sum, tp) => sum + (items.value[tp]?.length || 0), 0))

async function restoreItem(type: string, id: string) {
  try { await api.post(`/recycle-bin/${type}/${id}/restore`, {}); await fetchAll() }
  catch { error.value = t('recycleBin.restoreError') }
}

async function deleteForever(type: string, id: string) {
  try { await api.delete(`/recycle-bin/${type}/${id}`); await fetchAll() }
  catch { error.value = t('recycleBin.deleteError') }
}

function confirmEmpty() { emptyDialog.value = true }
async function emptyAll() {
  try { await api.delete('/recycle-bin'); emptyDialog.value = false; await fetchAll() }
  catch { error.value = t('recycleBin.emptyError') }
}

function getItemLabel(item: any) { return item.serialNumber || item.name || (item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : null) || '—' }
const { fmtDate } = useFormatters()

onMounted(fetchAll)
</script>

<template>
  <div class="view-page">
    <div class="view-inner">
      <Message v-if="error" severity="error" closable @close="error = null" class="mb-4">{{ error }}</Message>

      <div class="view-header">
        <div>
          <h1 class="text-2xl font-bold">{{ t('recycleBin.title') }}</h1>
          <p class="mt-1" style="color:var(--an-text-muted);font-size:14px;">{{ t('recycleBin.subtitle', { count: totalCount }) }}</p>
        </div>
        <Button severity="danger" outlined icon="pi pi-trash" :label="t('recycleBin.emptyAll')" :disabled="totalCount === 0" @click="confirmEmpty" />
      </div>

      <TabView v-model:activeIndex="activeTab" class="mb-4">
        <TabPanel v-for="type in TYPES" :key="type" :value="type" :header="t('recycleBin.types.' + type)">
        </TabPanel>
      </TabView>

      <div v-if="loading" class="flex justify-content-center p-5"><i class="pi pi-spin pi-spinner" style="font-size:2rem;"></i></div>

      <div v-else class="an-card">
        <div v-if="currentItems.length > 0">
          <div v-for="item in currentItems" :key="item._id" class="list-item">
            <div class="flex align-items-center gap-3">
              <i class="pi pi-trash" style="color:var(--an-text-muted);"></i>
              <div>
                <div class="font-bold" style="font-size:14px;">{{ getItemLabel(item) }}</div>
                <div style="font-size:12px;color:var(--an-text-muted);">{{ t('recycleBin.deletedOn') }} {{ fmtDate(item.deletedAt) }}</div>
              </div>
            </div>
            <div class="flex align-items-center gap-2">
              <Button size="small" text severity="success" icon="pi pi-replay" :label="t('recycleBin.restore')" @click="restoreItem(activeType, item._id)" />
              <Button size="small" text severity="danger" icon="pi pi-trash" :label="t('recycleBin.deleteForever')" @click="deleteForever(activeType, item._id)" />
            </div>
          </div>
        </div>
        <div v-else class="text-center" style="padding:40px;color:var(--an-text-muted);">
          <i class="pi pi-trash mb-2" style="font-size:48px;opacity:0.3;"></i>
          <div class="mt-2">{{ t('recycleBin.empty') }}</div>
        </div>
      </div>
      <Dialog v-model:visible="emptyDialog" :header="$t('common.confirmDelete')" :style="{width:'400px'}" modal>
        <p>{{ $t('recycleBin.emptyConfirm') }}</p>
        <template #footer>
          <Button :label="$t('common.cancel')" text @click="emptyDialog = false" />
          <Button :label="$t('recycleBin.emptyAll')" severity="danger" @click="emptyAll" />
        </template>
      </Dialog>
    </div>
  </div>
</template>

