'use client'

import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function Header() {
  const { profile, loading } = useUser()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-[#0E3F75] text-white">
        <div className="flex h-16 items-center px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded bg-[#5CADEB]" />
            <span className="text-lg font-semibold">Sistema de Gestión de Reclamos</span>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#88C1ED]/20 bg-[#0E3F75] text-white shadow-sm">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Logo and Title */}
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5CADEB] font-bold text-white">
            SGR
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold">Sistema de Gestión de Reclamos</span>
            <span className="text-xs text-[#88C1ED]">Secretaría Municipal</span>
          </div>
        </div>

        {/* User Menu */}
        {profile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 text-white hover:bg-[#5CADEB]/20 hover:text-white"
              >
                <User className="h-5 w-5" />
                <div className="hidden flex-col items-start sm:flex">
                  <span className="text-sm font-medium">{profile.full_name}</span>
                  <span className="text-xs text-[#88C1ED]">{profile.role}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{profile.full_name}</p>
                  <p className="text-xs text-muted-foreground">{profile.email}</p>
                  <p className="text-xs font-semibold text-[#5CADEB]">{profile.role}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
