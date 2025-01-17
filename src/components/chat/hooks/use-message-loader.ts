import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageData } from '../types';
import { useSupabase } from '@/components/providers/supabase-provider';

const MESSAGES_PER_BATCH = 20;

type MessageResponse = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  channel_id: string;
  parent_id: string | null;
  files: any[];
  profiles: {
    username: string;
    avatar_url: string | null;
  };
};

export function useMessageLoader(channelId: string) {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { supabase, user, isLoading: isUserLoading } = useSupabase();
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);

  // Use ref to track mounted state
  const isMounted = useRef(true);
  // Use ref to track current messages to avoid dependency cycle
  const messagesRef = useRef<MessageData[]>([]);
  // Use ref to track current load request
  const currentLoadRef = useRef<number | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      currentLoadRef.current = null;
    };
  }, []);

  const loadMessages = useCallback(
    async (offset = 0, messageId?: string) => {
      const loadId = Date.now();
      currentLoadRef.current = loadId;

      try {
        console.log('[MessageLoader] Starting load:', {
          loadId,
          channelId,
          offset,
          messageId,
          isUserLoading,
          userId: user?.id,
          isAuthenticated: !!user,
        });

        // Don't attempt to load if user auth is still loading
        if (isUserLoading) {
          console.log('[MessageLoader] User auth still loading');
          return;
        }

        if (!user) {
          console.log('[MessageLoader] No authenticated user');
          setError('Please sign in to view messages');
          setIsInitialLoading(false);
          return;
        }

        // Only set loading states for subsequent loads
        if (offset > 0) {
          setIsLoadingMore(true);
        }

        // First verify channel access
        const { data: channelAccess, error: channelError } = await supabase
          .from('channels')
          .select('id, is_private, is_direct_message')
          .eq('id', channelId)
          .single();

        // Check if this load request is still valid
        if (!isMounted.current || currentLoadRef.current !== loadId) {
          console.log('[MessageLoader] Load request no longer valid, aborting');
          return;
        }

        if (channelError) {
          console.error('[MessageLoader] Channel access error:', channelError);
          setError(`Failed to verify channel access: ${channelError.message}`);
          setIsInitialLoading(false);
          return;
        }

        if (!channelAccess) {
          setIsInitialLoading(false);
          return;
        }

        // For non-DM channels, ensure user membership
        if (!channelAccess.is_direct_message) {
          // First check if membership already exists
          const { data: existingMembership } = await supabase
            .from('user_channels')
            .select('user_id')
            .eq('user_id', user.id)
            .eq('channel_id', channelId)
            .single();

          // Only try to create membership if it doesn't exist
          if (!existingMembership) {
            const { error: membershipError } = await supabase.from('user_channels').upsert(
              {
                user_id: user.id,
                channel_id: channelId,
                role: 'member',
              },
              {
                onConflict: 'user_id,channel_id',
              }
            );

            if (membershipError) {
              // Log for debugging but continue since the channel is public
              console.debug(
                '[MessageLoader] Note: Could not create channel membership, but continuing as channel is public'
              );
            }
          }
        }

        // If we have a messageId, load all messages
        let query = supabase
          .from('messages')
          .select(
            `
          id,
          content,
          created_at,
          user_id,
          channel_id,
          parent_id,
          files,
          profiles!inner (
            username,
            avatar_url
          )
        `
          )
          .eq('channel_id', channelId)
          .is('parent_id', null)
          .order('created_at', { ascending: true });

        if (!messageId) {
          // Get total count first for pagination
          const { count, error: countError } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', channelId)
            .is('parent_id', null);

          if (countError) {
            console.error('[MessageLoader] Count query error:', countError);
            setError(`Failed to load messages: ${countError.message}`);
            setIsInitialLoading(false);
            return;
          }

          const totalMessages = count || 0;
          // Calculate the range for the next batch of messages
          const startIndex = Math.max(0, totalMessages - MESSAGES_PER_BATCH - offset);
          const endIndex = Math.max(0, totalMessages - offset - 1);

          if (startIndex >= endIndex) {
            setHasMore(false);
            setIsInitialLoading(false);
            return;
          }

          query = query.range(startIndex, endIndex);
        }

        const { data: messageData, error: messageError } = await query.returns<MessageResponse[]>();

        if (messageError) {
          console.error('[MessageLoader] Message query error:', messageError);
          setError(`Failed to load messages: ${messageError.message}`);
          setIsInitialLoading(false);
          return;
        }

        if (!messageData || messageData.length === 0) {
          setHasMore(false);
          setIsInitialLoading(false);
          return;
        }

        console.log('[MessageLoader] Successfully loaded messages:', messageData.length);

        // Convert response to MessageData format
        const formattedMessages: MessageData[] = messageData.map((msg) => ({
          id: msg.id,
          content: msg.content,
          created_at: msg.created_at,
          user_id: msg.user_id,
          channel_id: msg.channel_id,
          parent_id: msg.parent_id,
          files: msg.files,
          profiles: {
            username: msg.profiles.username,
            avatar_url: msg.profiles.avatar_url,
          },
        }));

        if (messageId) {
          setMessages(formattedMessages);
          setHasMore(false);
          setFocusedMessageId(messageId);
        } else if (offset === 0) {
          setMessages(formattedMessages);
          setHasMore(formattedMessages.length >= MESSAGES_PER_BATCH);
        } else {
          setMessages((prev) => [...formattedMessages, ...prev]);
          setHasMore(formattedMessages.length >= MESSAGES_PER_BATCH);
        }
      } catch (err) {
        if (isMounted.current && currentLoadRef.current === loadId) {
          console.error('[MessageLoader] Unexpected error:', err);
          setError('An unexpected error occurred');
        }
      } finally {
        if (isMounted.current && currentLoadRef.current === loadId) {
          setIsInitialLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [channelId, supabase, user, isUserLoading]
  );

  // Load initial messages when channelId changes or auth state changes
  useEffect(() => {
    // Reset state when channel changes
    setMessages([]);
    setError(null);
    setHasMore(true);
    setIsInitialLoading(true);
    setFocusedMessageId(null);

    // Check for messageId in URL
    const searchParams = new URLSearchParams(window.location.search);
    const messageId = searchParams.get('messageId');

    // Only load if we have a user and aren't already loading
    if (!isUserLoading && user) {
      console.log('[MessageLoader] Initial load effect triggered');
      loadMessages(0, messageId || undefined);
    }

    // Cleanup function
    return () => {
      currentLoadRef.current = null; // Cancel any ongoing loads
    };
  }, [channelId, loadMessages, user, isUserLoading]);

  return {
    messages,
    error,
    isInitialLoading,
    isLoadingMore,
    hasMore,
    focusedMessageId,
    loadMoreMessages: () => loadMessages(messages.length),
    addMessage: (message: MessageData) => {
      setMessages((prev) => [...prev, message]);
    },
    updateMessage: (messageId: string, updates: Partial<MessageData>) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
      );
    },
    deleteMessage: (messageId: string) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    },
  };
}
