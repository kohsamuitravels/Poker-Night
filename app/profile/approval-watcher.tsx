'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type ApprovalWatcherProps = {
  userId: string
  currentRole: string
}

export function ApprovalWatcher({ userId, currentRole }: ApprovalWatcherProps) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (currentRole !== 'pending') {
      return
    }

    const channel = supabase
      .channel(`profile-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const newRole = payload.new?.role
          const oldRole = payload.old?.role

          if (oldRole === 'pending' && newRole && newRole !== 'pending') {
            toast.success("Welcome! You've been approved 🎉", {
              description: 'Redirecting to lobby...',
              duration: 3000,
            })

            setTimeout(() => {
              router.push('/lobby')
              router.refresh()
            }, 1000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, currentRole, router, supabase])

  return null
}
