<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import GenericCrudView from '../components/GenericCrudView.vue'
import type { CrudColumnDef, FormField } from '../components/GenericCrudView.vue'

const { t } = useI18n()

const columns: CrudColumnDef[] = [
  { key: 'name', label: t('manufacturers.name'), default: true, render: { type: 'bold' } },
  { key: 'url', label: t('manufacturers.url'), default: true, render: { type: 'link' } },
  { key: 'supportUrl', label: t('manufacturers.supportUrl'), default: false, render: { type: 'link' } },
  { key: 'supportEmail', label: t('manufacturers.supportEmail'), default: true, render: { type: 'mailto' } },
  { key: 'notes', label: t('common.notes'), default: false },
  { key: 'createdAt', label: t('common.createdAt'), default: false, format: 'date' },
]

const formFields: FormField[] = [
  { key: 'name', label: t('manufacturers.name'), required: true },
  { key: 'url', label: t('manufacturers.url'), type: 'url' },
  { key: 'supportUrl', label: t('manufacturers.supportUrl'), type: 'url' },
  { key: 'supportEmail', label: t('manufacturers.supportEmail'), type: 'email' },
  { key: 'notes', label: t('common.notes'), type: 'textarea' },
]
</script>

<template>
  <GenericCrudView
    :title="t('manufacturers.title')"
    :subtitle="t('manufacturers.subtitle')"
    api-endpoint="/manufacturers"
    :columns="columns"
    :form-fields="formFields"
    entity-type="Manufacturer"
    storage-key="manufacturers"
    :add-label="t('manufacturers.add')"
    :search-placeholder="t('manufacturers.search')"
    :add-dialog-title="t('manufacturers.add')"
    :edit-dialog-title="t('manufacturers.edit')"
    :delete-dialog-title="t('manufacturers.deleteConfirm')"
    :delete-dialog-message="(name: string) => t('manufacturers.deleteMessage', { name })"
  />
</template>
