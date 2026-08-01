import type { Component } from 'vue'
import TriggerEventParams from './params/TriggerEventParams.vue'
import TriggerScheduleParams from './params/TriggerScheduleParams.vue'
import TriggerWebhookParams from './params/TriggerWebhookParams.vue'
import TriggerManualParams from './params/TriggerManualParams.vue'
import ConditionParams from './params/ConditionParams.vue'
import LogicSwitchParams from './params/LogicSwitchParams.vue'
import LogicDelayParams from './params/LogicDelayParams.vue'
import LogicMergeParams from './params/LogicMergeParams.vue'
import LogicStopErrorParams from './params/LogicStopErrorParams.vue'
import LogicLoopParams from './params/LogicLoopParams.vue'
import LogicApprovalParams from './params/LogicApprovalParams.vue'
import ActionNotifyParams from './params/ActionNotifyParams.vue'
import ActionStatusParams from './params/ActionStatusParams.vue'
import ActionAssignParams from './params/ActionAssignParams.vue'
import ActionUpdateFieldParams from './params/ActionUpdateFieldParams.vue'
import ActionTagParams from './params/ActionTagParams.vue'
import ActionMaintenanceParams from './params/ActionMaintenanceParams.vue'
import ActionWebhookParams from './params/ActionWebhookParams.vue'
import ActionAuditLogParams from './params/ActionAuditLogParams.vue'
import ActionSyncParams from './params/ActionSyncParams.vue'
import ActionHelpdeskParams from './params/ActionHelpdeskParams.vue'
import ActionRespondParams from './params/ActionRespondParams.vue'
import ActionGetRecordsParams from './params/ActionGetRecordsParams.vue'

// Node type → parameters form rendered in the NodeDetailPanel. Types without
// an entry (logic-noop) show "no parameters".
export const NODE_PARAMS_REGISTRY: Record<string, Component> = {
  'trigger-event': TriggerEventParams,
  'trigger-schedule': TriggerScheduleParams,
  'trigger-webhook': TriggerWebhookParams,
  'trigger-manual': TriggerManualParams,
  'condition': ConditionParams,
  'filter': ConditionParams,
  'logic-switch': LogicSwitchParams,
  'logic-delay': LogicDelayParams,
  'logic-merge': LogicMergeParams,
  'logic-stop-error': LogicStopErrorParams,
  'logic-loop': LogicLoopParams,
  'logic-approval': LogicApprovalParams,
  'action-notify': ActionNotifyParams,
  'action-status': ActionStatusParams,
  'action-assign': ActionAssignParams,
  'action-update-field': ActionUpdateFieldParams,
  'action-tag': ActionTagParams,
  'action-maintenance': ActionMaintenanceParams,
  'action-webhook': ActionWebhookParams,
  'action-audit-log': ActionAuditLogParams,
  'action-sync': ActionSyncParams,
  'action-helpdesk': ActionHelpdeskParams,
  'action-respond': ActionRespondParams,
  'action-get-records': ActionGetRecordsParams
}
