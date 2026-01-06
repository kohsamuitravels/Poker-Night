import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut, User, Shield } from 'lucide-react'
import Link from 'next/link'

async function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <Button variant="outline" type="submit">
        <LogOut className="mr-2 h-4 w-4" />
        Sign Out
      </Button>
    </form>
  )
}

const roleColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  user: 'bg-blue-100 text-blue-800 border-blue-300',
  manager: 'bg-purple-100 text-purple-800 border-purple-300',
  super_admin: 'bg-green-100 text-green-800 border-green-300',
}

const roleLabels = {
  pending: 'Pending',
  user: 'User',
  manager: 'Manager',
  super_admin: 'Super Admin',
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  const userRole = profile?.role || 'pending'
  const isSuperAdmin = userRole === 'super_admin'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">Profile</CardTitle>
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <Link href="/admin">
                  <Button variant="outline">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin Dashboard
                  </Button>
                </Link>
              )}
              <SignOutButton />
            </div>
          </div>
          <CardDescription>
            You are successfully logged in!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-lg">
            <div className="flex-shrink-0">
              {(profile?.avatar_url || user.user_metadata?.avatar_url) ? (
                <img
                  src={profile?.avatar_url || user.user_metadata?.avatar_url}
                  alt="Profile"
                  className="h-16 w-16 rounded-full"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="h-8 w-8 text-slate-500" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1">
              {(profile?.full_name || user.user_metadata?.full_name) && (
                <p className="text-lg font-semibold text-slate-900">
                  {profile?.full_name || user.user_metadata?.full_name}
                </p>
              )}
              {user.email && (
                <p className="text-sm text-slate-600">{user.email}</p>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <h3 className="text-sm font-semibold text-slate-700">Account Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-slate-600">User ID:</span>
                <span className="font-mono text-xs text-slate-900">{user.id}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-slate-600">Role:</span>
                <Badge
                  variant="outline"
                  className={roleColors[userRole as keyof typeof roleColors]}
                >
                  {roleLabels[userRole as keyof typeof roleLabels]}
                </Badge>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-slate-600">Provider:</span>
                <span className="text-slate-900 capitalize">
                  {user.app_metadata?.provider || 'google'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-600">Last Sign In:</span>
                <span className="text-slate-900">
                  {user.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
