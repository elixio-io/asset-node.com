import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPut, ApiResult } from './api-client.js'


const server = new McpServer({
  name: 'AssetNode',
  version: '1.0.0',
  description: 'IT-Asset-Management — manage hardware, employees, assignments, licenses, and compliance'
})

function toContent(result: ApiResult): { content: { type: 'text'; text: string }[] } {
  return {
    content: [{
      type: 'text' as const,
      text: result.success
        ? JSON.stringify(result.data, null, 2)
        : `❌ ${result.error}`
    }]
  }
}


server.tool(
  'search_hardware',
  'Search hardware assets by serial number, model, manufacturer, category, or status. Returns a list of matching items.',
  {
    search: z.string().optional().describe('Free-text search across serial number, model, manufacturer'),
    category: z.string().optional().describe('Filter by category: laptop, desktop, tablet, phone, server, networking, printer, monitor, other'),
    status: z.string().optional().describe('Filter by status: available, assigned, inRepair, defective, retired, disposed, lost, forSale, onOrder'),
    manufacturer: z.string().optional().describe('Filter by manufacturer name')
  },
  async (params) => toContent(await apiGet('/hardware', params))
)

server.tool(
  'get_hardware',
  'Get detailed information about a specific hardware asset by its ID.',
  { id: z.string().describe('Hardware asset ID') },
  async ({ id }) => toContent(await apiGet(`/hardware/${id}`))
)

server.tool(
  'create_hardware',
  'Register a new hardware asset in the system.',
  {
    serialNumber: z.string().describe('Unique serial number'),
    model: z.string().describe('Device model name'),
    category: z.string().describe('Category: laptop, desktop, tablet, phone, server, networking, printer, monitor, other'),
    manufacturer: z.string().describe('Manufacturer name'),
    purchaseDate: z.string().describe('Purchase date (ISO 8601)'),
    status: z.string().optional().describe('Initial status (default: available)'),
    purchasePrice: z.number().optional().describe('Purchase price in base currency'),
    warrantyExpiry: z.string().optional().describe('Warranty expiry date (ISO 8601)'),
    notes: z.string().optional().describe('Additional notes'),
    tags: z.array(z.string()).optional().describe('Tags for categorization')
  },
  async (params) => toContent(await apiPost('/hardware', params as Record<string, unknown>))
)

server.tool(
  'update_hardware',
  'Update fields on an existing hardware asset.',
  {
    id: z.string().describe('Hardware asset ID to update'),
    status: z.string().optional().describe('New status'),
    model: z.string().optional().describe('Updated model name'),
    notes: z.string().optional().describe('Updated notes'),
    tags: z.array(z.string()).optional().describe('Updated tags'),
    warrantyExpiry: z.string().optional().describe('Updated warranty expiry (ISO 8601)'),
    assignedTo: z.string().optional().describe('Employee ID to assign to (or null to unassign)')
  },
  async ({ id, ...body }) => toContent(await apiPut(`/hardware/${id}`, body as Record<string, unknown>))
)


server.tool(
  'search_employees',
  'Search employees by name, email, or department.',
  {
    search: z.string().optional().describe('Free-text search across first name, last name, email'),
    department: z.string().optional().describe('Filter by department'),
    isActive: z.boolean().optional().describe('Filter by active status')
  },
  async (params) => toContent(await apiGet('/employees', params as Record<string, string | boolean>))
)

server.tool(
  'get_employee',
  'Get detailed information about a specific employee.',
  { id: z.string().describe('Employee ID') },
  async ({ id }) => toContent(await apiGet(`/employees/${id}`))
)

server.tool(
  'create_employee',
  'Create a new employee record (asset recipient).',
  {
    firstName: z.string().describe('First name'),
    lastName: z.string().describe('Last name'),
    email: z.string().describe('Email address'),
    department: z.string().optional().describe('Department'),
    jobTitle: z.string().optional().describe('Job title'),
    startDate: z.string().optional().describe('Start date (ISO 8601)')
  },
  async (params) => toContent(await apiPost('/employees', params as Record<string, unknown>))
)


server.tool(
  'list_assignments',
  'List hardware assignments. Filter by employee, hardware, or status.',
  {
    employeeId: z.string().optional().describe('Filter by employee ID'),
    hardwareId: z.string().optional().describe('Filter by hardware ID'),
    status: z.string().optional().describe('Filter by status: active, pendingReturn, returned, cancelled')
  },
  async (params) => toContent(await apiGet('/assignments', params))
)

server.tool(
  'create_assignment',
  'Assign hardware to an employee. Creates a new assignment record and updates the hardware status.',
  {
    employeeId: z.string().describe('Employee ID to assign to'),
    hardwareId: z.string().describe('Hardware ID to assign'),
    notes: z.string().optional().describe('Assignment notes'),
    expectedReturnDate: z.string().optional().describe('Expected return date (ISO 8601)')
  },
  async (params) => toContent(await apiPost('/assignments', params as Record<string, unknown>))
)

server.tool(
  'return_assignment',
  'Initiate a return for an active assignment.',
  {
    id: z.string().describe('Assignment ID'),
    condition: z.string().optional().describe('Condition of returned device: good, damaged, defective'),
    notes: z.string().optional().describe('Return notes')
  },
  async ({ id, ...body }) => toContent(await apiPost(`/assignments/${id}/return`, body as Record<string, unknown>))
)


server.tool(
  'get_dashboard',
  'Get the full dashboard overview: KPI cards, status breakdown, category breakdown, alerts, and recent activity.',
  {},
  async () => toContent(await apiGet('/dashboard/stats'))
)


server.tool(
  'list_categories',
  'List all asset categories defined in the organization.',
  {},
  async () => toContent(await apiGet('/categories'))
)

server.tool(
  'list_departments',
  'List all departments in the organization.',
  {},
  async () => toContent(await apiGet('/departments'))
)

server.tool(
  'list_locations',
  'List all physical locations / offices.',
  {},
  async () => toContent(await apiGet('/locations'))
)

server.tool(
  'list_manufacturers',
  'List all hardware manufacturers.',
  {},
  async () => toContent(await apiGet('/manufacturers'))
)

server.tool(
  'list_suppliers',
  'List all approved suppliers.',
  {},
  async () => toContent(await apiGet('/suppliers'))
)


server.tool(
  'search_licenses',
  'Search software licenses.',
  {
    search: z.string().optional().describe('Search by name, key, or vendor'),
    isActive: z.boolean().optional().describe('Filter by active status')
  },
  async (params) => toContent(await apiGet('/licenses', params as Record<string, string | boolean>))
)

server.tool(
  'search_consumables',
  'Search consumable inventory (cables, adapters, etc.).',
  {
    search: z.string().optional().describe('Search by name or category'),
    isActive: z.boolean().optional().describe('Filter by active status')
  },
  async (params) => toContent(await apiGet('/consumables', params as Record<string, string | boolean>))
)

server.tool(
  'search_peripherals',
  'Search peripheral devices (monitors, keyboards, mice, etc.).',
  {
    search: z.string().optional().describe('Search by serial, model, or type'),
    type: z.string().optional().describe('Filter by type'),
    status: z.string().optional().describe('Filter by status')
  },
  async (params) => toContent(await apiGet('/peripherals', params))
)

server.tool(
  'get_audit_log',
  'Query audit trail entries. Shows who did what and when.',
  {
    entityType: z.string().optional().describe('Filter by entity type: Hardware, Employee, Assignment, etc.'),
    action: z.string().optional().describe('Filter by action: create, update, delete'),
    limit: z.number().optional().describe('Number of entries to return (default: 20)')
  },
  async (params) => toContent(await apiGet('/audits', params as Record<string, string | number>))
)


server.resource(
  'dashboard',
  'assetnode://dashboard',
  { description: 'Live dashboard summary — KPIs, alerts, status breakdown, recent activity' },
  async () => {
    const result = await apiGet('/dashboard/stats')
    return {
      contents: [{
        uri: 'assetnode://dashboard',
        mimeType: 'application/json',
        text: result.success ? JSON.stringify(result.data, null, 2) : `Error: ${result.error}`
      }]
    }
  }
)


server.prompt(
  'onboard_employee',
  'Step-by-step guide for onboarding a new employee with hardware assignment.',
  {
    employeeName: z.string().describe('Name of the new employee'),
    department: z.string().optional().describe('Department'),
    role: z.string().optional().describe('Job title/role')
  },
  async ({ employeeName, department, role }) => ({
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `Please help me onboard a new employee:
- Name: ${employeeName}
- Department: ${department || 'not specified'}
- Role: ${role || 'not specified'}

Steps to complete:
1. Create the employee record using create_employee
2. Search for available hardware using search_hardware with status "available"
3. Assign appropriate devices using create_assignment
4. Verify the dashboard reflects the changes using get_dashboard

Please proceed step by step.`
      }
    }]
  })
)

server.prompt(
  'inventory_audit',
  'Walk through an inventory reconciliation — check for discrepancies.',
  {},
  async () => ({
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `Please perform an inventory audit:

1. Get the dashboard overview using get_dashboard to understand the current state
2. Search for all hardware using search_hardware to get the full inventory
3. Check for any items with concerning statuses (defective, lost, overdue returns)
4. Review expiring warranties using the dashboard data
5. Summarize findings with recommendations

Please proceed step by step and flag any discrepancies or items needing attention.`
      }
    }]
  })
)

server.prompt(
  'asset_check_in',
  'Process a device return / check-in workflow.',
  {
    employeeName: z.string().describe('Name of employee returning device'),
    serialNumber: z.string().optional().describe('Serial number of device being returned')
  },
  async ({ employeeName, serialNumber }) => ({
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `Please process a device check-in:
- Employee: ${employeeName}
- Serial Number: ${serialNumber || 'not provided — please search'}

Steps:
1. Find the employee using search_employees
2. List their active assignments using list_assignments
3. ${serialNumber ? `Find the matching device (serial: ${serialNumber})` : 'Identify the device to be returned'}
4. Process the return using return_assignment
5. Verify the hardware status was updated

Please proceed step by step.`
      }
    }]
  })
)


async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
