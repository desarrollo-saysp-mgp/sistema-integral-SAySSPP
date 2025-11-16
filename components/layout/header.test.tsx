import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { Header } from './header'

// Mock dependencies
vi.mock('@/hooks/useUser', () => ({
  useUser: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signOut: vi.fn(),
    },
  })),
}))

describe('Header', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('should render loading state when user is loading', async () => {
    const { useUser } = await import('@/hooks/useUser')
    vi.mocked(useUser).mockReturnValue({
      user: null,
      profile: null,
      loading: true,
      isAdmin: false,
      isAuthenticated: false,
      refreshProfile: vi.fn(),
    })

    render(<Header />)

    expect(screen.getByText('Sistema de Gestión de Reclamos')).toBeInTheDocument()
  })

  it('should render header with user info when logged in', async () => {
    const { useUser } = await import('@/hooks/useUser')
    vi.mocked(useUser).mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      profile: {
        id: '123',
        email: 'test@example.com',
        full_name: 'Juan Pérez',
        role: 'Admin',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      loading: false,
      isAdmin: true,
      isAuthenticated: true,
      refreshProfile: vi.fn(),
    })

    render(<Header />)

    expect(screen.getByText('Sistema de Gestión de Reclamos')).toBeInTheDocument()
    expect(screen.getByText('Secretaría Municipal')).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('should display SGR logo', async () => {
    const { useUser } = await import('@/hooks/useUser')
    vi.mocked(useUser).mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      isAdmin: false,
      isAuthenticated: false,
      refreshProfile: vi.fn(),
    })

    render(<Header />)

    expect(screen.getByText('SGR')).toBeInTheDocument()
  })

  it('should show user dropdown menu with email and role', async () => {
    const { useUser } = await import('@/hooks/useUser')
    const user = userEvent.setup()

    vi.mocked(useUser).mockReturnValue({
      user: { id: '123', email: 'admin@example.com' } as any,
      profile: {
        id: '123',
        email: 'admin@example.com',
        full_name: 'Admin User',
        role: 'Admin',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      loading: false,
      isAdmin: true,
      isAuthenticated: true,
      refreshProfile: vi.fn(),
    })

    render(<Header />)

    // Click on user button to open dropdown
    const userButton = screen.getByRole('button', { name: /Admin User/i })
    await user.click(userButton)

    // Check dropdown content
    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument()
      expect(screen.getByText('Cerrar Sesión')).toBeInTheDocument()
    })
  })
})
