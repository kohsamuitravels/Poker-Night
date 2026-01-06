import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Shield } from 'lucide-react'
import Link from 'next/link'
import { UserManagementTable } from './user-management-table'

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const { data: currentUserProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!currentUserProfile || currentUserProfile.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
              <Shield className="h-6 w-6 text-red-500" />
              Access Denied
            </CardTitle>
            <CardDescription className="text-center">
              You do not have permission to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/profile">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="h-8 w-8 text-blue-600" />
              Admin Dashboard
            </h1>
            <p className="text-slate-600 mt-1">Manage user roles and permissions</p>
          </div>
          <Link href="/profile">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Profile
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              View and manage user roles across your application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserManagementTable initialProfiles={profiles || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
