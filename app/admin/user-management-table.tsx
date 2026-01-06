'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Profile = {
  id: string
  email: string
  full_name: string | null
  role: string
  created_at: string
}

type UserManagementTableProps = {
  initialProfiles: Profile[]
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

export function UserManagementTable({ initialProfiles }: UserManagementTableProps) {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending'>('all')
  const router = useRouter()

  const filteredProfiles = filter === 'pending'
    ? profiles.filter((p) => p.role === 'pending')
    : profiles

  const updateRole = async (userId: string, newRole: string) => {
    setLoadingUserId(userId)

    try {
      const response = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, role: newRole }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update role')
      }

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === userId ? { ...p, role: newRole } : p
        )
      )

      router.refresh()
    } catch (error) {
      console.error('Error updating role:', error)
      alert(error instanceof Error ? error.message : 'Failed to update role')
    } finally {
      setLoadingUserId(null)
    }
  }

  return (
    <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'pending')}>
      <TabsList className="mb-4">
        <TabsTrigger value="all">
          All Users ({profiles.length})
        </TabsTrigger>
        <TabsTrigger value="pending">
          Pending ({profiles.filter((p) => p.role === 'pending').length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value={filter}>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredProfiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.email}</TableCell>
                    <TableCell>{profile.full_name || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={roleColors[profile.role as keyof typeof roleColors]}
                      >
                        {roleLabels[profile.role as keyof typeof roleLabels]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(profile.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={loadingUserId === profile.id}
                          >
                            {loadingUserId === profile.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              <>
                                Change Role
                                <ChevronDown className="ml-2 h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => updateRole(profile.id, 'user')}
                            disabled={profile.role === 'user'}
                          >
                            Make User
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateRole(profile.id, 'manager')}
                            disabled={profile.role === 'manager'}
                          >
                            Make Manager
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateRole(profile.id, 'super_admin')}
                            disabled={profile.role === 'super_admin'}
                          >
                            Make Super Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateRole(profile.id, 'pending')}
                            disabled={profile.role === 'pending'}
                          >
                            Make Pending
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  )
}
