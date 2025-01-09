import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateChannelDialog } from '../create-channel-dialog';
import { useSupabase } from '@/lib/hooks/use-supabase';
import { vi, expect, describe, it, beforeEach } from 'vitest';
import { toast } from 'sonner';

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

// Mock dependencies
vi.mock('@/lib/hooks/use-supabase', () => ({
  useSupabase: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('CreateChannelDialog', () => {
  // Mock implementation of useSupabase
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  };

  const mockOnChannelCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useSupabase as any).mockReturnValue({ supabase: mockSupabase });
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'test-user-id' } } });
    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  // Test 1: Component renders correctly
  it('renders create channel button', () => {
    render(<CreateChannelDialog />);
    expect(screen.getByText('Create Channel')).toBeInTheDocument();
  });

  // Test 2: Opens dialog on button click
  it('opens dialog when create button is clicked', () => {
    render(<CreateChannelDialog />);
    fireEvent.click(screen.getByText('Create Channel'));
    expect(screen.getByText('Create a New Channel')).toBeInTheDocument();
  });

  // Test 3: Validates required fields
  it('shows error when trying to create channel without name', async () => {
    render(<CreateChannelDialog />);
    fireEvent.click(screen.getByText('Create Channel'));
    fireEvent.click(screen.getByRole('button', { name: 'Create Channel' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Channel name is required');
    });
  });

  // Test 4: Successfully creates channel
  it('creates channel successfully', async () => {
    // Mock channel creation response
    const mockChannel = {
      id: 'test-channel-id',
      name: 'test-channel',
      description: 'Test channel description',
      created_by: 'test-user-id',
      is_private: false,
    };

    mockSupabase.from.mockImplementation((table) => ({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockChannel, error: null }),
        }),
      }),
      ...(table === 'user_channels' && {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    }));
    
    render(<CreateChannelDialog onChannelCreated={mockOnChannelCreated} />);
    
    // Open dialog
    fireEvent.click(screen.getByText('Create Channel'));
    
    // Fill form
    fireEvent.change(screen.getByPlaceholderText('e.g. marketing'), {
      target: { value: 'test-channel' },
    });
    fireEvent.change(screen.getByPlaceholderText("What's this channel about?"), {
      target: { value: 'Test channel description' },
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'Create Channel' }));

    await waitFor(() => {
      // Verify channel creation
      expect(mockSupabase.from).toHaveBeenCalledWith('channels');
      expect(mockSupabase.from('channels').insert).toHaveBeenCalledWith({
        name: 'test-channel',
        description: 'Test channel description',
        created_by: 'test-user-id',
        is_private: false,
      });

      // Verify user membership creation
      expect(mockSupabase.from).toHaveBeenCalledWith('user_channels');
      expect(mockSupabase.from('user_channels').insert).toHaveBeenCalledWith({
        channel_id: 'test-channel-id',
        user_id: 'test-user-id',
        role: 'admin'
      });

      expect(toast.success).toHaveBeenCalledWith('Channel created successfully');
      expect(mockOnChannelCreated).toHaveBeenCalled();
    });
  });

  // Test 5: Handles creation error
  it('handles channel creation error', async () => {
    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: new Error('Database error') }),
    });

    render(<CreateChannelDialog />);
    
    // Open dialog
    fireEvent.click(screen.getByText('Create Channel'));
    
    // Fill form
    fireEvent.change(screen.getByPlaceholderText('e.g. marketing'), {
      target: { value: 'test-channel' },
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'Create Channel' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to create channel');
    });
  });

  // Test 6: Closes dialog on cancel
  it('closes dialog when cancel is clicked', () => {
    render(<CreateChannelDialog />);
    
    // Open dialog
    fireEvent.click(screen.getByText('Create Channel'));
    expect(screen.getByText('Create a New Channel')).toBeInTheDocument();
    
    // Click cancel
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Create a New Channel')).not.toBeInTheDocument();
  });

  // Test 7: Disables form inputs during submission
  it('disables form inputs during submission', async () => {
    render(<CreateChannelDialog />);
    
    // Open dialog
    fireEvent.click(screen.getByText('Create Channel'));
    
    // Wait for dialog to open
    await waitFor(() => {
      expect(screen.getByText('Create a New Channel')).toBeInTheDocument();
    });
    
    // Fill form
    fireEvent.change(screen.getByPlaceholderText('e.g. marketing'), {
      target: { value: 'test-channel' },
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'Create Channel' }));

    // Check if inputs are disabled during submission
    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. marketing')).toBeDisabled();
      expect(screen.getByPlaceholderText("What's this channel about?")).toBeDisabled();
    });
  });

  // Test 8: Handles membership creation error
  it('handles membership creation error', async () => {
    // Mock successful channel creation but failed membership creation
    const mockChannel = {
      id: 'test-channel-id',
      name: 'test-channel',
      description: 'Test channel description',
      created_by: 'test-user-id',
      is_private: false,
    };

    mockSupabase.from.mockImplementation((table) => ({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockChannel, error: null }),
        }),
      }),
      ...(table === 'user_channels' && {
        insert: vi.fn().mockResolvedValue({ error: new Error('Membership error') }),
      }),
    }));

    render(<CreateChannelDialog />);
    
    // Open dialog
    fireEvent.click(screen.getByText('Create Channel'));
    
    // Fill form
    fireEvent.change(screen.getByPlaceholderText('e.g. marketing'), {
      target: { value: 'test-channel' },
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'Create Channel' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to create channel');
    });
  });
}); 