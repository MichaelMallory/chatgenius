import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MessageReactions } from '../message-reactions'
import { useSupabase } from '@/components/providers/supabase-provider'
import { supabase } from '@/lib/supabase'

// Mock dependencies
jest.mock('@/components/providers/supabase-provider', () => ({
  useSupabase: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  },
}))

jest.mock('../emoji-picker', () => ({
  EmojiPicker: ({ onEmojiSelect }: { onEmojiSelect: (emoji: any) => void }) => (
    <button
      data-testid="emoji-picker"
      onClick={() => onEmojiSelect({ native: '😊' })}
    >
      Add Reaction
    </button>
  ),
}))

describe('MessageReactions', () => {
  const mockUser = { id: 'user-1' }
  const mockProps = {
    messageId: 'msg-1',
    channelId: 'channel-1',
  }

  beforeEach(() => {
    (useSupabase as jest.Mock).mockReturnValue({ user: mockUser })
    jest.clearAllMocks()
  })

  it('renders emoji picker button', () => {
    render(<MessageReactions {...mockProps} />)
    expect(screen.getByTestId('emoji-picker')).toBeInTheDocument()
  })

  it('loads initial reactions', async () => {
    const mockReactions = [
      { emoji: '😊', user_id: 'user-1' },
      { emoji: '😊', user_id: 'user-2' },
      { emoji: '👍', user_id: 'user-3' },
    ]

    ;(supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: mockReactions, error: null })),
      })),
    })

    render(<MessageReactions {...mockProps} />)

    await waitFor(() => {
      // Should show 2 reaction buttons (😊 with count 2, and 👍 with count 1)
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3) // 2 reactions + emoji picker
      expect(buttons[0]).toHaveTextContent('😊 2')
      expect(buttons[1]).toHaveTextContent('👍 1')
    })
  })

  it('handles adding a new reaction', async () => {
    render(<MessageReactions {...mockProps} />)

    // Click emoji picker to add reaction
    fireEvent.click(screen.getByTestId('emoji-picker'))

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('reactions')
      expect(supabase.from().insert).toHaveBeenCalledWith({
        message_id: mockProps.messageId,
        user_id: mockUser.id,
        emoji: '😊',
      })
    })
  })

  it('handles removing an existing reaction', async () => {
    const mockReactions = [
      { emoji: '😊', user_id: mockUser.id }, // User's own reaction
    ]

    ;(supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: mockReactions, error: null })),
      })),
    })

    render(<MessageReactions {...mockProps} />)

    await waitFor(() => {
      const reactionButton = screen.getByText('😊 1')
      expect(reactionButton).toHaveClass('secondary') // Should have secondary variant for user's own reaction
    })

    // Click the reaction to remove it
    fireEvent.click(screen.getByText('😊 1'))

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('reactions')
      expect(supabase.from().delete).toHaveBeenCalled()
    })
  })

  it('handles errors when loading reactions', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    ;(supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: new Error('Failed to load') })),
      })),
    })

    render(<MessageReactions {...mockProps} />)

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled()
    })

    consoleError.mockRestore()
  })

  it('handles errors when adding/removing reactions', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    ;(supabase.from as jest.Mock).mockReturnValueOnce({
      insert: jest.fn(() => Promise.resolve({ data: null, error: new Error('Failed to add reaction') })),
    })

    render(<MessageReactions {...mockProps} />)

    // Try to add reaction
    fireEvent.click(screen.getByTestId('emoji-picker'))

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled()
    })

    consoleError.mockRestore()
  })
}) 