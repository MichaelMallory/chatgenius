'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Message } from './message';
import { Button } from '@/components/ui/button';
import { ArrowDown, Loader2 } from 'lucide-react';
import { MessageListProps, ThreadPosition, MessageData } from './types';
import { useMessageLoader } from './hooks/use-message-loader';
import { useMessageScroll } from './hooks/use-message-scroll';
import { useSupabase } from '@/components/providers/supabase-provider';
import { subscriptionManager } from '@/lib/subscription-manager';
import { ThreadView } from './thread-view';

export function MessageList({ channelId, threadView, onThreadViewChange }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const focusedMessageRef = useRef<HTMLDivElement>(null);
  const { supabase } = useSupabase();
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const prevMessagesLengthRef = useRef(0);

  const {
    messages,
    error,
    isInitialLoading,
    isLoadingMore,
    hasMore,
    loadMoreMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    focusedMessageId,
  } = useMessageLoader(channelId);

  const { showScrollButton } = useMessageScroll({
    messageListRef,
    messages,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToFocusedMessage = useCallback(() => {
    if (focusedMessageRef.current) {
      focusedMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight the message temporarily
      focusedMessageRef.current.classList.add('bg-muted/50');
      setTimeout(() => {
        focusedMessageRef.current?.classList.remove('bg-muted/50');
      }, 2000);
    }
  }, []);

  // Handle scroll to load more messages
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    // Check if we're near the top (within 100px) and have more messages to load
    const isNearTop = scrollTop < 100;
    if (isNearTop && !isLoadingMore && hasMore) {
      const oldScrollHeight = e.currentTarget.scrollHeight;
      loadMoreMessages().then(() => {
        // After loading more messages, restore scroll position
        if (messageListRef.current) {
          const newScrollHeight = messageListRef.current.scrollHeight;
          messageListRef.current.scrollTop = newScrollHeight - oldScrollHeight;
        }
      });
    }

    // Update auto-scroll behavior based on scroll position
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldScrollToBottom(isNearBottom);
  };

  // Handle initial scroll and message updates
  useEffect(() => {
    if (isInitialLoad && messages.length > 0) {
      if (focusedMessageId) {
        scrollToFocusedMessage();
      } else {
        scrollToBottom();
      }
      setIsInitialLoad(false);
    } else if (
      messages.length > prevMessagesLengthRef.current &&
      shouldScrollToBottom &&
      !focusedMessageId
    ) {
      scrollToBottom();
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isInitialLoad, shouldScrollToBottom, focusedMessageId, scrollToFocusedMessage]);

  // Reset state when channel changes
  useEffect(() => {
    setIsInitialLoad(true);
    setShouldScrollToBottom(true);
    prevMessagesLengthRef.current = 0;
  }, [channelId]);

  // Set up realtime subscription using the subscription manager
  useEffect(() => {
    let isSubscribed = true;

    const unsubscribe = subscriptionManager.subscribe(channelId, async (payload) => {
      if (!isSubscribed) return;

      if (payload.eventType === 'INSERT' && !payload.new.parent_id) {
        const { data: newMessage } = await supabase
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
          .eq('id', payload.new.id)
          .returns<MessageData[]>()
          .single();

        if (!newMessage || !isSubscribed) {
          console.error('Error fetching new message or component unmounted');
          return;
        }

        addMessage(newMessage);
      }
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [channelId, supabase, addMessage]);

  const handleReply = (messageId: string) => {
    onThreadViewChange?.({ messageId });
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={messageListRef}
      className="flex-1 overflow-y-auto space-y-4 p-4"
      onScroll={handleScroll}
    >
      {isInitialLoading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {isLoadingMore && (
            <div className="flex justify-center p-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                ref={message.id === focusedMessageId ? focusedMessageRef : undefined}
                className="transition-colors duration-500"
              >
                <Message
                  id={message.id}
                  content={message.content}
                  username={message.profiles.username}
                  avatarUrl={message.profiles.avatar_url || undefined}
                  createdAt={new Date(message.created_at)}
                  userId={message.user_id}
                  channelId={message.channel_id}
                  files={message.files}
                  onDelete={() => deleteMessage(message.id)}
                  onReply={handleReply}
                />
              </div>
            ))}
          </div>
          <div ref={messagesEndRef} />
          {showScrollButton && !focusedMessageId && (
            <Button
              size="icon"
              variant="outline"
              className="fixed bottom-24 right-8 rounded-full shadow-md"
              onClick={scrollToBottom}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
      {threadView && (
        <div className="fixed inset-y-0 right-0 w-96 bg-background border-l">
          <ThreadView
            parentMessageId={threadView.messageId}
            channelId={channelId}
            onClose={() => onThreadViewChange?.(null)}
          />
        </div>
      )}
    </div>
  );
}
