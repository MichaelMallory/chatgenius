import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DirectMessageDialog } from '../direct-message-dialog'
import { useSupabase } from '@/lib/hooks/use-supabase'
import { vi, expect, describe, it, beforeEach } from 'vitest'
import { toast } from 'sonner'

// Mock dependencies
vi.mock('@/lib/hooks/use-supabase', () => ({
  useSupabase: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('DirectMessageDialog', () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useSupabase as any).mockReturnValue({ supabase: mockSupabase })
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'current-user-id' } }, error: null })
  })

  // Test 1: Component renders correctly
  it('renders direct message button', () => {
    render(<DirectMessageDialog />)
    expect(screen.getByText('Direct Message')).toBeInTheDocument()
  })

  // Test 2: Opens dialog on button click
  it('opens dialog when button is clicked', () => {
    render(<DirectMessageDialog />)
    fireEvent.click(screen.getByText('Direct Message'))
    expect(screen.getByText('Start Direct Message')).toBeInTheDocument()
  })

  // Test 3: Validates empty username
  it('shows error when trying to start DM without username', async () => {
    render(<DirectMessageDialog />)
    fireEvent.click(screen.getByText('Direct Message'))
    fireEvent.click(screen.getByText('Start Chat'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please enter a username')
    })
  })

  // Test 4: Handles non-existent user
  it('shows error when user is not found', async () => {
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: new Error('User not found') }),
      }),
    }))

    render(<DirectMessageDialog />)
    fireEvent.click(screen.getByText('Direct Message'))
    fireEvent.change(screen.getByPlaceholderText('Enter username'), {
      target: { value: 'nonexistent' },
    })
    fireEvent.click(screen.getByText('Start Chat'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('User not found')
    })
  })

  // Test 5: Successfully creates new DM channel
  it('creates DM channel successfully', async () => {
    const mockTargetUser = { id: 'target-user-id' }
    const mockNewChannel = { id: 'new-channel-id' }

    // Mock successful user lookup
    mockSupabase.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockTargetUser, error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockNewChannel, error: null }),
        }),
      }),
    }))

    // Mock window.location.href
    const originalLocation = window.location
    delete window.location
    window.location = { ...originalLocation, href: '' }

    render(<DirectMessageDialog />)
    fireEvent.click(screen.getByText('Direct Message'))
    fireEvent.change(screen.getByPlaceholderText('Enter username'), {
      target: { value: 'targetuser' },
    })
    fireEvent.click(screen.getByText('Start Chat'))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Direct message created')
      expect(window.location.href).toBe('/channels/new-channel-id')
    })

    // Restore window.location
    window.location = originalLocation
  })

  // Test 6: Handles existing DM channel
  it('redirects to existing DM channel', async () => {
    const mockExistingChannel = { id: 'existing-channel-id' }
    const mockTargetUser = { id: 'target-user-id' }

    mockSupabase.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: table === 'profiles'
            ? vi.fn().mockResolvedValue({ data: mockTargetUser, error: null })
            : vi.fn().mockReturnValue({
                contains: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockExistingChannel, error: null }),
                }),
              }),
        }),
      }),
    }))

    // Mock window.location.href
    const originalLocation = window.location
    delete window.location
    window.location = { ...originalLocation, href: '' }

    render(<DirectMessageDialog />)
    fireEvent.click(screen.getByText('Direct Message'))
    fireEvent.change(screen.getByPlaceholderText('Enter username'), {
      target: { value: 'existinguser' },
    })
    fireEvent.click(screen.getByText('Start Chat'))

    await waitFor(() => {
      expect(window.location.href).toBe('/channels/existing-channel-id')
    })

    // Restore window.location
    window.location = originalLocation
  })

  // Test 7: Handles channel creation error
  it('handles channel creation error', async () => {
    const mockTargetUser = { id: 'target-user-id' }

    mockSupabase.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockTargetUser, error: null }),
          contains: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockRejectedValue(new Error('Failed to create channel')),
        }),
      }),
    }))

    render(<DirectMessageDialog />)
    fireEvent.click(screen.getByText('Direct Message'))
    fireEvent.change(screen.getByPlaceholderText('Enter username'), {
      target: { value: 'targetuser' },
    })
    fireEvent.click(screen.getByText('Start Chat'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to create direct message')
    })
  })

  // Test 8: Disables form during submission
  it('disables form inputs during submission', async () => {
    const mockTargetUser = { id: 'target-user-id' }

    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockTargetUser, error: null }),
        }),
      }),
    }))

    render(<DirectMessageDialog />)
    fireEvent.click(screen.getByText('Direct Message'))
    fireEvent.change(screen.getByPlaceholderText('Enter username'), {
      target: { value: 'targetuser' },
    })
    fireEvent.click(screen.getByText('Start Chat'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter username')).toBeDisabled()
      expect(screen.getByText('Start Chat')).toBeDisabled()
      expect(screen.getByText('Cancel')).toBeDisabled()
    })
  })
}) 