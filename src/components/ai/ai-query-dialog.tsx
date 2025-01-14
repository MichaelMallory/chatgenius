'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { Bot, Send } from 'lucide-react';
import { useSupabase } from '@/lib/hooks/use-supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface Citation {
  messageId: string;
  content: string;
  username: string;
  timestamp: Date;
  channelName: string;
  channelId: string;
}

interface AIResponse {
  content: string;
  citations: Citation[];
  feedbackSubmitted?: boolean;
}

interface AIQueryDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  channel?: {
    id: string;
    name: string;
  };
}

export function AIQueryDialog({ open: controlledOpen, onOpenChange, channel }: AIQueryDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [response, setResponse] = React.useState<AIResponse | null>(null);
  const { supabase } = useSupabase();
  const router = useRouter();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = React.useState(false);
  const mounted = React.useRef(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = React.useCallback(
    (value: boolean) => {
      if (isControlled) {
        onOpenChange?.(value);
      } else {
        setInternalOpen(value);
      }
    },
    [isControlled, onOpenChange]
  );

  // Handle Cmd/Ctrl + / to open AI query
  useHotkeys(
    ['meta+/', 'ctrl+/'],
    (event: KeyboardEvent) => {
      event.preventDefault();
      if (!open && mounted.current) {
        setOpen(true);
      }
    },
    {
      enableOnFormTags: true,
      preventDefault: true,
      enabled: !isLoading,
    }
  );

  // Focus textarea when dialog opens and cleanup when it closes
  React.useEffect(() => {
    mounted.current = true;

    if (open && mounted.current) {
      const timer = setTimeout(() => {
        if (textareaRef.current && mounted.current) {
          textareaRef.current.focus();
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    return () => {
      mounted.current = false;
    };
  }, [open]);

  // Separate cleanup effect that only runs when explicitly closing
  React.useEffect(() => {
    if (!open && !isMinimized && mounted.current) {
      setQuery('');
      setResponse(null);
      setIsLoading(false);
      if (textareaRef.current) {
        textareaRef.current.blur();
      }
    }
  }, [open, isMinimized]);

  const handleSubmit = async () => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          channelId: channel?.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      setResponse(data);
    } catch (error) {
      console.error('AI query error:', error);
      toast.error('Failed to get AI response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCitationClick = (citation: Citation) => {
    setIsMinimized(true); // Minimize instead of closing
    setOpen(false);
    const params = new URLSearchParams();
    params.set('messageId', citation.messageId);
    router.push(`/channels/${citation.channelId}?${params.toString()}`);
  };

  const handleFeedback = async (isPositive: boolean) => {
    if (!response || response.feedbackSubmitted || isFeedbackLoading) return;

    setIsFeedbackLoading(true);
    try {
      // TODO: Implement actual feedback submission endpoint
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API delay

      // Update response state to show feedback was submitted
      setResponse((prev) =>
        prev
          ? {
              ...prev,
              feedbackSubmitted: true,
            }
          : null
      );

      toast.success('Thank you for your feedback!');
    } catch (error) {
      console.error('Feedback submission error:', error);
      toast.error('Failed to submit feedback');
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  const AIResponseComponent = forwardRef<HTMLDivElement, { response: AIResponse }>(
    function AIResponseInner({ response }, ref) {
      if (!response) return null;

      // Split content into main response and sources if "Sources:" section exists
      const [mainContent, sourcesSection] = response.content.split(/^Sources:/m);

      return (
        <div ref={ref} className="space-y-4">
          {/* Main response content */}
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{mainContent.trim()}</ReactMarkdown>
          </div>

          {/* Sources section if it exists */}
          {sourcesSection && (
            <div className="mt-6 space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Sources</h3>
              <div className="space-y-2">
                {response.citations.map((citation, index) => (
                  <button
                    key={citation.messageId}
                    onClick={() => handleCitationClick(citation)}
                    className="flex items-start gap-2 w-full p-2 text-sm rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback>{citation.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">@{citation.username}</span>
                        <span className="text-xs text-muted-foreground">
                          in #{citation.channelName}
                        </span>
                      </div>
                      <p className="text-muted-foreground line-clamp-2">{citation.content}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback buttons */}
          {!response.feedbackSubmitted && (
            <div className="flex items-center justify-end gap-2 pt-4">
              <p className="text-sm text-muted-foreground mr-2">Was this response helpful?</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFeedback(true)}
                disabled={isFeedbackLoading}
              >
                👍
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFeedback(false)}
                disabled={isFeedbackLoading}
              >
                👎
              </Button>
            </div>
          )}
        </div>
      );
    }
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen && !isMinimized) {
            setOpen(false);
          } else if (!newOpen && isMinimized) {
            setOpen(false);
          } else {
            setOpen(true);
            setIsMinimized(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="px-4 py-2 border-b">
            <DialogTitle>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Ask AI Assistant
                </div>
              </div>
            </DialogTitle>
            {response && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-12 top-2"
                onClick={() => {
                  setIsMinimized(true);
                  setOpen(false);
                }}
              >
                Minimize
              </Button>
            )}
          </DialogHeader>
          <div className="flex flex-col h-[60vh]">
            <ScrollArea className="flex-1 p-4">
              {response && <AIResponseComponent response={response} />}
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">Thinking...</div>
                </div>
              )}
            </ScrollArea>
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  placeholder="Ask a question..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="flex-1"
                  rows={3}
                />
                <Button
                  onClick={handleSubmit}
                  disabled={!query.trim() || isLoading}
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating button when minimized */}
      {isMinimized && response && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          <div className="bg-background/80 backdrop-blur-sm p-4 rounded-lg shadow-lg border max-w-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">AI Response</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsMinimized(false);
                  setResponse(null);
                }}
              >
                Close
              </Button>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {response.content.split(/^Sources:/m)[0].trim()}
            </p>
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                setIsMinimized(false);
                setOpen(true);
              }}
            >
              <Bot className="h-4 w-4 mr-2" />
              View Full Response
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
