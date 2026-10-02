import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.error('====================================================')
    console.error('🚨 CLIENT RUNTIME ERROR CAUGHT BY ERROR BOUNDARY 🚨')
    console.error('Reference ID:', body.referenceId)
    console.error('URL:', body.url)
    console.error('Message:', body.message)
    console.error('Stack:', body.stack)
    console.error('====================================================')
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 400 })
  }
}
