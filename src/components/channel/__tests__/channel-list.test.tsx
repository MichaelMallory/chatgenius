import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChannelList } from '../channel-list';
import { useSupabase } from '@/lib/hooks/use-supabase';
import { useRouter } from 'next/navigation';
import { vi, expect, describe, it, beforeEach } from 'vitest';
import { toast } from 'sonner';

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

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

describe('ChannelList', () => {
  const mockChannels = [
    {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'general',
      description: 'General channel',
      created_by: 'test-user-id',
      is_private: false,
    },
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'random',
      description: 'Random discussions',
      created_by: 'test-user-id',
      is_private: false,
    },
  ];

  const mockSupabase = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockChannels, error: null }),
      }),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({
        unsubscribe: vi.fn(),
      }),
    }),
  };

  const mockRouter = {
    push: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useSupabase as any).mockReturnValue({ supabase: mockSupabase });
    (useRouter as any).mockReturnValue(mockRouter);
  });

  // Test 1: Component renders and fetches channels
  it('renders channel list and fetches channels', async () => {
    render(<ChannelList />);

    // Check loading state
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Wait for channels to load
    await waitFor(() => {
      expect(screen.getByText('general')).toBeInTheDocument();
      expect(screen.getByText('random')).toBeInTheDocument();
    });

    // Verify Supabase calls
    expect(mockSupabase.from).toHaveBeenCalledWith('channels');
  });

  // Test 2: Channel navigation
  it('navigates to selected channel', async () => {
    render(<ChannelList />);

    // Wait for channels to load
    await waitFor(() => {
      expect(screen.getByText('random')).toBeInTheDocument();
    });

    // Click on a channel
    fireEvent.click(screen.getByText('random'));

    // Verify navigation
    expect(mockRouter.push).toHaveBeenCalledWith('/channels/11111111-1111-1111-1111-111111111111');
  });

  // Test 3: Error handling
  it('handles fetch error gracefully', async () => {
    // Mock error response
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('Fetch error') }),
      }),
    });

    render(<ChannelList />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load channels');
    });
  });

  // Test 4: Real-time updates
  it('subscribes to channel updates', async () => {
    render(<ChannelList />);

    // Verify subscription setup
    expect(mockSupabase.channel).toHaveBeenCalledWith('channels-changes');
    expect(mockSupabase.channel().on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'channels'
      },
      expect.any(Function)
    );
    expect(mockSupabase.channel().subscribe).toHaveBeenCalled();
  });

  // Test 5: Active channel highlighting
  it('highlights active channel', async () => {
    render(<ChannelList />);

    await waitFor(() => {
      expect(screen.getByText('general')).toBeInTheDocument();
    });

    const generalButton = screen.getByText('general').closest('button');
    expect(generalButton).toHaveClass('bg-muted');
  });

  // Test 6: Create channel dialog integration
  it('shows create channel dialog', async () => {
    render(<ChannelList />);

    await waitFor(() => {
      expect(screen.getByText('Create Channel')).toBeInTheDocument();
    });
  });

  // Test 7: Cleanup on unmount
  it('unsubscribes on unmount', async () => {
    const unsubscribe = vi.fn();
    mockSupabase.channel.mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe }),
    });

    const { unmount } = render(<ChannelList />);
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
}); 