import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_ROLES = ['pending', 'user', 'manager', 'super_admin']

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: currentUserProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!currentUserProfile || currentUserProfile.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Access denied. Super admin role required.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userId, role } = body

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'Missing userId or role' },
        { status: 400 }
      )
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
