import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut, Users, Shield, User as UserIcon } from 'lucide-react'
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

export default async function LobbyPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, email')
    .eq('id', user.id)
    .maybeSingle()

  const userRole = profile?.role || 'pending'

  if (userRole === 'pending') {
    redirect('/profile')
  }

  const isSuperAdmin = userRole === 'super_admin'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">Lobby</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/profile">
                <Button variant="ghost" size="sm">
                  <UserIcon className="mr-2 h-4 w-4" />
                  Profile
                </Button>
              </Link>
              {isSuperAdmin && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              )}
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to the Lobby</CardTitle>
            <CardDescription>
              You're logged in as {profile?.email || user.email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {(profile?.avatar_url || user.user_metadata?.avatar_url) ? (
                  <img
                    src={profile?.avatar_url || user.user_metadata?.avatar_url}
                    alt="Profile"
                    className="h-12 w-12 rounded-full"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center">
                    <UserIcon className="h-6 w-6 text-slate-500" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                {(profile?.full_name || user.user_metadata?.full_name) && (
                  <p className="font-semibold text-slate-900">
                    {profile?.full_name || user.user_metadata?.full_name}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-slate-600">Role:</span>
                  <Badge
                    variant="outline"
                    className={roleColors[userRole as keyof typeof roleColors]}
                  >
                    {roleLabels[userRole as keyof typeof roleLabels]}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Table Invitations</CardTitle>
            <CardDescription>
              Your active and pending game invitations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-lg font-medium">No invitations yet</p>
              <p className="text-sm">Your table invitations will appear here.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
