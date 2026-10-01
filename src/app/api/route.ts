import { withApi } from '@/lib/with-api'
import { ok } from '@/lib/api'

export const GET = withApi(async () => {
  return ok({
    status: 'online',
    service: 'PreOne Enterprise OS',
    timestamp: new Date().toISOString(),
  })
}, { module: 'core' })