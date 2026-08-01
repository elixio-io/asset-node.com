<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import GenericCrudView from '../components/GenericCrudView.vue'
import type { CrudColumnDef, FormField } from '../components/GenericCrudView.vue'

const { t } = useI18n()

const columns: CrudColumnDef[] = [
  { key: 'name', label: t('suppliers.name'), default: true, render: { type: 'bold' } },
  { key: 'contactName', label: t('suppliers.contactName'), default: true },
  { key: 'email', label: t('suppliers.email'), default: true, render: { type: 'mailto' } },
  { key: 'phone', label: t('suppliers.phone'), default: true },
  { key: 'url', label: t('suppliers.url'), default: false, render: { type: 'link' } },
  { key: 'notes', label: t('common.notes'), default: false },
  { key: 'createdAt', label: t('common.createdAt'), default: false, format: 'date' },
]

const formFields: FormField[] = [
  { key: 'name', label: t('suppliers.name'), required: true },
  { key: 'contactName', label: t('suppliers.contactName') },
  { key: 'email', label: t('suppliers.email'), type: 'email' },
  { key: 'phone', label: t('suppliers.phone') },
  { key: 'url', label: t('suppliers.url'), type: 'url' },
  { key: 'notes', label: t('common.notes'), type: 'textarea' },
]
</script>

<template>
  <GenericCrudView
    :title="t('suppliers.title')"
    :subtitle="t('suppliers.subtitle')"
    api-endpoint="/suppliers"
    :columns="columns"
    :form-fields="formFields"
    entity-type="Supplier"
    storage-key="suppliers"
    :add-label="t('suppliers.add')"
    :search-placeholder="t('suppliers.search')"
    :add-dialog-title="t('suppliers.add')"
    :edit-dialog-title="t('suppliers.edit')"
    :delete-dialog-title="t('suppliers.deleteConfirm')"
    :delete-dialog-message="(name: string) => t('suppliers.deleteMessage', { name })"
    :no-data-message="t('suppliers.noItems')"
  />
</template>
