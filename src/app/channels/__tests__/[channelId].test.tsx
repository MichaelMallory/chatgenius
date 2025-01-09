import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ChannelPage from '../[channelId]/page';
import { useSupabase } from '@/lib/hooks/use-supabase';
import { useRouter } from 'next/navigation';
import { vi, expect, describe, it, beforeEach } from 'vitest';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/lib/hooks/use-supabase', () => ({
  useSupabase: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/components/chat/message-list', () => ({
  MessageList: () => <div data-testid="message-list">Message List</div>,
}));

vi.mock('@/components/chat/message-input', () => ({
  MessageInput: () => <div data-testid="message-input">Message Input</div>,
}));

describe('ChannelPage', () => {
  const mockUser = { id: 'test-user-id' };
  const mockPublicChannel = {
    id: 'test-channel-id',
    name: 'test-channel',
    description: 'Test channel',
    is_private: false,
    created_by: 'creator-id',
  };
  const mockPrivateChannel = {
    ...mockPublicChannel,
    is_private: true,
  };

  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  };

  const mockRouter = {
    push: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useSupabase as any).mockReturnValue({ supabase: mockSupabase });
    (useRouter as any).mockReturnValue(mockRouter);
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
  });

  // Test 1: Loads public channel successfully
  it('loads public channel and creates membership if needed', async () => {
    // Mock channel fetch
    mockSupabase.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockPublicChannel, error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }));

    render(<ChannelPage params={{ channelId: 'test-channel-id' }} />);

    await waitFor(() => {
      expect(screen.getByText('test-channel')).toBeInTheDocument();
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });
  });

  // Test 2: Handles private channel access correctly
  it('blocks access to private channel without membership', async () => {
    // Mock private channel fetch
    mockSupabase.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: table === 'channels'
            ? vi.fn().mockResolvedValue({ data: mockPrivateChannel, error: null })
            : vi.fn().mockRejectedValue(new Error('No membership')),
        }),
      }),
    }));

    render(<ChannelPage params={{ channelId: 'test-channel-id' }} />);

    await waitFor(() => {
      expect(screen.getByText('This is a private channel. You need an invitation to join.')).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith('Failed to access the channel');
    });
  });

  // Test 3: Allows access to private channel with membership
  it('allows access to private channel with membership', async () => {
    // Mock private channel fetch with membership
    mockSupabase.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: table === 'channels' ? mockPrivateChannel : { role: 'member' },
            error: null,
          }),
        }),
      }),
    }));

    render(<ChannelPage params={{ channelId: 'test-channel-id' }} />);

    await waitFor(() => {
      expect(screen.getByText('test-channel')).toBeInTheDocument();
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });
  });

  // Test 4: Redirects unauthenticated users
  it('redirects to sign-in when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    render(<ChannelPage params={{ channelId: 'test-channel-id' }} />);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    });
  });

  // Test 5: Handles channel fetch error
  it('handles channel fetch error gracefully', async () => {
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockRejectedValue(new Error('Channel not found')),
        }),
      }),
    }));

    render(<ChannelPage params={{ channelId: 'test-channel-id' }} />);

    await waitFor(() => {
      expect(screen.getByText('Unable to access this channel')).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith('Failed to access the channel');
    });
  });

  // Test 6: Creates membership for public channel
  it('creates membership for public channel when not exists', async () => {
    const membershipInsert = vi.fn().mockResolvedValue({ error: null });
    
    // Mock channel fetch success but no existing membership
    mockSupabase.from.mockImplementation((table) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: table === 'channels'
            ? vi.fn().mockResolvedValue({ data: mockPublicChannel, error: null })
            : vi.fn().mockRejectedValue(new Error('No membership')),
        }),
      }),
      insert: membershipInsert,
    }));

    render(<ChannelPage params={{ channelId: 'test-channel-id' }} />);

    await waitFor(() => {
      expect(membershipInsert).toHaveBeenCalledWith({
        channel_id: 'test-channel-id',
        user_id: 'test-user-id',
        role: 'member',
      });
      expect(screen.getByText('test-channel')).toBeInTheDocument();
    });
  });
}); 