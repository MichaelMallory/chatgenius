import { useEffect, useState, RefObject, useCallback } from 'react';
import { MessageData } from '../types';

interface UseMessageScrollProps {
  messageListRef: RefObject<HTMLDivElement>;
  messages: MessageData[];
}

export function useMessageScroll({ messageListRef, messages }: UseMessageScrollProps) {
  const [showScrollButton, setShowScrollButton] = useState(false);

  const handleScroll = useCallback(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;

    const { scrollTop, scrollHeight, clientHeight } = messageList;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  }, [messageListRef]);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (messageList) {
      messageList.addEventListener('scroll', handleScroll);
      // Initial check
      handleScroll();
      return () => messageList.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, messageListRef]);

  // Scroll to bottom on new messages only if already at bottom
  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList || !messages.length) return;

    const { scrollTop, scrollHeight, clientHeight } = messageList;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    if (isNearBottom) {
      messageList.scrollTop = scrollHeight;
    }
  }, [messages, messageListRef]);

  return { showScrollButton };
}
