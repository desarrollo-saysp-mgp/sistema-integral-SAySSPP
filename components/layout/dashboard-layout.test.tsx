import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DashboardLayout } from './dashboard-layout'

// Mock all dependencies
vi.mock('./header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}))

vi.mock('./app-sidebar', () => ({
  AppSidebar: () => <div data-testid="sidebar">Sidebar</div>,
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: any) => <div>{children}</div>,
  SidebarInset: ({ children }: any) => <div>{children}</div>,
}))

describe('DashboardLayout', () => {
  beforeEach(() => {
    cleanup()
  })
  it('should render children content', () => {
    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>
    )

    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('should render Header component', () => {
    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    )

    expect(screen.getByTestId('header')).toBeInTheDocument()
  })

  it('should render AppSidebar component', () => {
    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    )

    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
  })

  it('should wrap content in main tag', () => {
    const { container } = render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    )

    const mainElement = container.querySelector('main')
    expect(mainElement).toBeInTheDocument()
    expect(mainElement).toHaveTextContent('Content')
  })
})
