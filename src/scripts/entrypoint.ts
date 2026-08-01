
import { execSync } from 'child_process'

console.log('🔄 Running migrations...')

try {
  execSync('npx tsx src/scripts/migrate-org-defaults.ts', { stdio: 'inherit' })
  console.log('✅ Migrations complete')
} catch (err) {
  console.error('⚠️  Migration failed, starting server anyway:', err)
}

console.log('🚀 Starting server...')
await import('../server/index.ts')
