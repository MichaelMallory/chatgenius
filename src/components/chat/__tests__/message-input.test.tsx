import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MessageInput } from '../message-input'
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
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: { id: 1 }, error: null })),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: 1 }, error: null })),
        })),
      })),
    })),
  },
}))

jest.mock('../emoji-picker', () => ({
  EmojiPicker: ({ onEmojiSelect }: { onEmojiSelect: (emoji: any) => void }) => (
    <button
      data-testid="emoji-picker"
      onClick={() => onEmojiSelect({ native: '😊' })}
    >
      Add Emoji
    </button>
  ),
}))

describe('MessageInput', () => {
  const mockUser = { id: 'user-1' }

  beforeEach(() => {
    (useSupabase as jest.Mock).mockReturnValue({ user: mockUser })
  })

  it('renders formatting buttons and emoji picker', () => {
    render(<MessageInput channelId="channel-1" />)

    expect(screen.getByTitle('Bold')).toBeInTheDocument()
    expect(screen.getByTitle('Italic')).toBeInTheDocument()
    expect(screen.getByTitle('Code')).toBeInTheDocument()
    expect(screen.getByTestId('emoji-picker')).toBeInTheDocument()
  })

  it('handles text formatting', () => {
    render(<MessageInput channelId="channel-1" />)

    const textarea = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(textarea, { target: { value: 'test' } })
    
    // Test bold formatting
    fireEvent.click(screen.getByTitle('Bold'))
    expect(textarea).toHaveValue('**test**')
  })

  it('handles emoji selection', () => {
    render(<MessageInput channelId="channel-1" />)

    const textarea = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(textarea, { target: { value: 'Hello ' } })
    
    fireEvent.click(screen.getByTestId('emoji-picker'))
    expect(textarea).toHaveValue('Hello 😊')
  })

  it('submits message successfully', async () => {
    render(<MessageInput channelId="channel-1" />)

    const textarea = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(textarea, { target: { value: 'test message' } })
    
    const sendButton = screen.getByRole('button', { name: /send/i })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('messages')
      expect(textarea).toHaveValue('')
    })
  })

  it('handles message submission error', async () => {
    const mockError = new Error('Failed to send message')
    jest.spyOn(supabase, 'from').mockImplementationOnce(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.reject(mockError)),
          })),
        })),
      })),
    }))

    render(<MessageInput channelId="channel-1" />)

    const textarea = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(textarea, { target: { value: 'test message' } })
    
    const sendButton = screen.getByRole('button', { name: /send/i })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText(/Failed to send message/i)).toBeInTheDocument()
    })
  })
}) 