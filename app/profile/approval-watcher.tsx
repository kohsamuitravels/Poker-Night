'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type ApprovalWatcherProps = {
  userId: string
  currentRole: string
}

export function ApprovalWatcher({ userId, currentRole }: ApprovalWatcherProps) {
  const router = useRouter()
  const redirectedRef = useRef(false)

  useEffect(() => {
    if (currentRole !== 'pending') return

    const supabase = createClient()

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
          const newRole = (payload.new as any)?.role
          const oldRole = (payload.old as any)?.role

          if (redirectedRef.current) return

          if (oldRole === 'pending' && newRole && newRole !== 'pending') {
            redirectedRef.current = true

            toast.success("Welcome! You've been approved 🎉", {
              description: 'Redirecting to lobby...',
              duration: 3000,
            })

            // אין באמת צורך ב-timeout; אם את רוצה להשאיר UX—קצר יותר
            setTimeout(() => {
              router.push('/lobby')
              router.refresh()
            }, 300)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, currentRole, router])

  return null
}
