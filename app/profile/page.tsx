import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut, User, Shield, Clock, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { ApprovalWatcher } from './approval-watcher'

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
  const isPending = userRole === 'pending'

  if (isPending) {
    return (
      <>
        <ApprovalWatcher userId={user.id} currentRole={userRole} />
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold">Profile</CardTitle>
                <SignOutButton />
              </div>
              <CardDescription>
                Your account is pending approval
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <Clock className="h-16 w-16 text-yellow-600" />
                    <div className="absolute inset-0 animate-ping">
                      <Clock className="h-16 w-16 text-yellow-400 opacity-75" />
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Waiting for Admin Approval
                </h3>
                <p className="text-slate-600 mb-4">
                  Your account has been created successfully. An administrator will review and approve your account shortly.
                </p>
                <Badge
                  variant="outline"
                  className="bg-yellow-100 text-yellow-800 border-yellow-300"
                >
                  Status: Pending
                </Badge>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-sm font-semibold text-slate-700">Account Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-slate-600">User ID:</span>
                    <span className="font-mono text-xs text-slate-900">{user.id}</span>
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
      </>
    )
  }

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
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-900 mb-1">
                  Your account is approved!
                </p>
                <p className="text-sm text-green-700">
                  You can now access the lobby and all available features.
                </p>
              </div>
              <Link href="/lobby">
                <Button className="bg-green-600 hover:bg-green-700">
                  Go to Lobby
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

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
