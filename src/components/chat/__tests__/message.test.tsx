import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Message } from '../message'
import { useSupabase } from '@/components/providers/supabase-provider'
import { supabase } from '@/lib/supabase'

// Mock dependencies
jest.mock('@/components/providers/supabase-provider', () => ({
  useSupabase: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  },
}))

// Mock MessageReactions component
jest.mock('../message-reactions', () => ({
  MessageReactions: ({ messageId, channelId }: { messageId: string, channelId: string }) => (
    <div data-testid="message-reactions" data-message-id={messageId} data-channel-id={channelId}>
      Message Reactions
    </div>
  ),
}))

describe('Message', () => {
  const mockMessage = {
    id: 'msg-1',
    content: 'Test message',
    username: 'testuser',
    avatarUrl: 'https://example.com/avatar.jpg',
    createdAt: new Date(),
    userId: 'user-1',
    channelId: 'channel-1',
  }

  const mockCurrentUser = { id: 'user-1' }

  beforeEach(() => {
    (useSupabase as jest.Mock).mockReturnValue({ user: mockCurrentUser })
  })

  it('renders message content and user info', () => {
    render(
      <Message
        id={mockMessage.id}
        content={mockMessage.content}
        username={mockMessage.username}
        avatarUrl={mockMessage.avatarUrl}
        createdAt={mockMessage.createdAt}
        userId={mockMessage.userId}
        channelId={mockMessage.channelId}
      />
    )

    expect(screen.getByText(mockMessage.content)).toBeInTheDocument()
    expect(screen.getByText(mockMessage.username)).toBeInTheDocument()
  })

  it('shows edit/delete buttons only for current user\'s messages', () => {
    render(
      <Message
        id={mockMessage.id}
        content={mockMessage.content}
        username={mockMessage.username}
        avatarUrl={mockMessage.avatarUrl}
        createdAt={mockMessage.createdAt}
        userId={mockMessage.userId}
        channelId={mockMessage.channelId}
      />
    )

    expect(screen.getByTitle('Edit message')).toBeInTheDocument()
    expect(screen.getByTitle('Delete message')).toBeInTheDocument()

    // Render message from different user
    render(
      <Message
        id={mockMessage.id}
        content={mockMessage.content}
        username={mockMessage.username}
        avatarUrl={mockMessage.avatarUrl}
        createdAt={mockMessage.createdAt}
        userId="different-user"
        channelId={mockMessage.channelId}
      />
    )

    expect(screen.queryByTitle('Edit message')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Delete message')).not.toBeInTheDocument()
  })

  it('enters edit mode on edit button click', () => {
    render(
      <Message
        id={mockMessage.id}
        content={mockMessage.content}
        username={mockMessage.username}
        avatarUrl={mockMessage.avatarUrl}
        createdAt={mockMessage.createdAt}
        userId={mockMessage.userId}
        channelId={mockMessage.channelId}
      />
    )

    fireEvent.click(screen.getByTitle('Edit message'))
    expect(screen.getByRole('textbox')).toHaveValue(mockMessage.content)
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('updates message content on save', async () => {
    render(
      <Message
        id={mockMessage.id}
        content={mockMessage.content}
        username={mockMessage.username}
        avatarUrl={mockMessage.avatarUrl}
        createdAt={mockMessage.createdAt}
        userId={mockMessage.userId}
        channelId={mockMessage.channelId}
      />
    )

    fireEvent.click(screen.getByTitle('Edit message'))
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Updated message' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('messages')
      expect(screen.getByText('Updated message')).toBeInTheDocument()
    })
  })

  it('cancels edit mode without changes', () => {
    render(
      <Message
        id={mockMessage.id}
        content={mockMessage.content}
        username={mockMessage.username}
        avatarUrl={mockMessage.avatarUrl}
        createdAt={mockMessage.createdAt}
        userId={mockMessage.userId}
        channelId={mockMessage.channelId}
      />
    )

    fireEvent.click(screen.getByTitle('Edit message'))
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Updated message' } })
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.getByText(mockMessage.content)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('deletes message on delete button click', async () => {
    const onDelete = jest.fn()
    render(
      <Message
        id={mockMessage.id}
        content={mockMessage.content}
        username={mockMessage.username}
        avatarUrl={mockMessage.avatarUrl}
        createdAt={mockMessage.createdAt}
        userId={mockMessage.userId}
        channelId={mockMessage.channelId}
        onDelete={onDelete}
      />
    )

    fireEvent.click(screen.getByTitle('Delete message'))
    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('messages')
      expect(onDelete).toHaveBeenCalledWith(mockMessage.id)
    })
  })

  it('cancels message deletion', () => {
    const onDelete = jest.fn()
    render(
      <Message
        id={mockMessage.id}
        content={mockMessage.content}
        username={mockMessage.username}
        avatarUrl={mockMessage.avatarUrl}
        createdAt={mockMessage.createdAt}
        userId={mockMessage.userId}
        channelId={mockMessage.channelId}
        onDelete={onDelete}
      />
    )

    fireEvent.click(screen.getByTitle('Delete message'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByText(mockMessage.content)).toBeInTheDocument()
  })

  it('renders message reactions component', () => {
    render(
      <Message
        id={mockMessage.id}
        content={mockMessage.content}
        username={mockMessage.username}
        avatarUrl={mockMessage.avatarUrl}
        createdAt={mockMessage.createdAt}
        userId={mockMessage.userId}
        channelId={mockMessage.channelId}
      />
    )

    const reactionsComponent = screen.getByTestId('message-reactions')
    expect(reactionsComponent).toBeInTheDocument()
    expect(reactionsComponent).toHaveAttribute('data-message-id', mockMessage.id)
    expect(reactionsComponent).toHaveAttribute('data-channel-id', mockMessage.channelId)
  })

  it('aligns reactions to the right for current user\'s messages', () => {
    render(
      <Message
        id={mockMessage.id}
        content={mockMessage.content}
        username={mockMessage.username}
        avatarUrl={mockMessage.avatarUrl}
        createdAt={mockMessage.createdAt}
        userId={mockCurrentUser.id}
        channelId={mockMessage.channelId}
      />
    )

    const reactionsComponent = screen.getByTestId('message-reactions')
    expect(reactionsComponent.parentElement).toHaveClass('text-right')
  })

  it('aligns reactions to the left for other users\' messages', () => {
    render(
      <Message
        id={mockMessage.id}
        content={mockMessage.content}
        username={mockMessage.username}
        avatarUrl={mockMessage.avatarUrl}
        createdAt={mockMessage.createdAt}
        userId="different-user"
        channelId={mockMessage.channelId}
      />
    )

    const reactionsComponent = screen.getByTestId('message-reactions')
    expect(reactionsComponent.parentElement).not.toHaveClass('text-right')
  })

  it('does not show reactions when editing message', () => {
    render(
      <Message
        id={mockMessage.id}
        content={mockMessage.content}
        username={mockMessage.username}
        avatarUrl={mockMessage.avatarUrl}
        createdAt={mockMessage.createdAt}
        userId={mockCurrentUser.id}
        channelId={mockMessage.channelId}
      />
    )

    // Enter edit mode
    fireEvent.click(screen.getByTitle('Edit message'))

    expect(screen.queryByTestId('message-reactions')).not.toBeInTheDocument()
  })
}) 