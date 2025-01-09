import { render, screen, fireEvent } from '@testing-library/react'
import { EmojiPicker } from '../emoji-picker'
import { ThemeProvider } from 'next-themes'
import { vi } from 'vitest'

// Mock emoji-mart components
vi.mock('@emoji-mart/react', () => ({
  default: ({ onEmojiSelect }: { onEmojiSelect: (emoji: any) => void }) => (
    <div data-testid="emoji-picker">
      <button onClick={() => onEmojiSelect({ native: '😊' })}>Select Emoji</button>
    </div>
  ),
}))

describe('EmojiPicker', () => {
  const mockOnEmojiSelect = vi.fn()

  beforeEach(() => {
    mockOnEmojiSelect.mockClear()
  })

  it('renders emoji picker button', () => {
    render(
      <ThemeProvider attribute="class">
        <EmojiPicker onEmojiSelect={mockOnEmojiSelect} />
      </ThemeProvider>
    )

    expect(screen.getByTitle('Add emoji')).toBeInTheDocument()
  })

  it('opens emoji picker on button click', () => {
    render(
      <ThemeProvider attribute="class">
        <EmojiPicker onEmojiSelect={mockOnEmojiSelect} />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByTitle('Add emoji'))
    expect(screen.getByTestId('emoji-picker')).toBeInTheDocument()
  })

  it('calls onEmojiSelect when emoji is selected', () => {
    render(
      <ThemeProvider attribute="class">
        <EmojiPicker onEmojiSelect={mockOnEmojiSelect} />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByTitle('Add emoji'))
    fireEvent.click(screen.getByText('Select Emoji'))
    expect(mockOnEmojiSelect).toHaveBeenCalledWith({ native: '😊' })
  })
}) 