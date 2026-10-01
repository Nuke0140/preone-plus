import { withApi } from '@/lib/with-api'
import { NextRequest, NextResponse } from 'next/server'
import { requireApi, isResponse } from '@/lib/auth-api'

/**
 * GET /api/v1/admissions/import/template?type=leads|applications
 * Downloads standardized CSV template for bulk import
 */
async function _GET(req: NextRequest) {
  const session = await requireApi(req, 'admissions:read')
  if (isResponse(session)) return session

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') === 'applications' ? 'applications' : 'leads'

  let csvContent = ''
  let filename = ''

  if (type === 'leads') {
    filename = 'preone_leads_template.csv'
    csvContent = [
      'parent_name,parent_phone,parent_email,child_name,child_dob,program,lead_source,notes',
      'Rahul Sharma,9876543210,rahul.sharma@example.com,Aarav Sharma,2023-05-15,NURSERY,WALK_IN,Interested in morning session',
      'Pooja Patil,9823456789,pooja.p@example.com,Rohan Patil,2022-08-20,LKG,PHONE,Requested campus tour',
    ].join('\n')
  } else {
    filename = 'preone_applications_template.csv'
    csvContent = [
      'child_first_name,child_last_name,dob,gender,program,parent_name,parent_phone,parent_email,address,notes',
      'Aarav,Sharma,2023-05-15,MALE,NURSERY,Rahul Sharma,9876543210,rahul.sharma@example.com,"Flat 402, Sunshine Residency",Direct application',
      'Ananya,Kulkarni,2022-11-10,FEMALE,LKG,Suresh Kulkarni,9822114455,suresh.k@example.com,"B-12, Green Acres",Relocated from Pune',
    ].join('\n')
  }

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export const GET = withApi(_GET)
