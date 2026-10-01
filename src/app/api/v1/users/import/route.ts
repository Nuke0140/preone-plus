import { withApi } from '@/lib/with-api'
import { GET as csvGET, POST as csvPOST } from '../csv/route'

export const GET = withApi(csvGET)
export const POST = withApi(csvPOST)
