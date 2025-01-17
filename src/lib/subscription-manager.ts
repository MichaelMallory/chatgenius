import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface Subscription {
  channel: RealtimeChannel;
  count: number;
}

class SubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map();

  subscribe(channelId: string, callback: (payload: any) => void) {
    // Check if we already have a subscription for this channel
    const existing = this.subscriptions.get(channelId);
    if (existing) {
      // Increment the reference count
      existing.count++;
      this.subscriptions.set(channelId, existing);
      return () => this.unsubscribe(channelId);
    }

    // Create a new subscription
    const channel = supabase
      .channel(`channel-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        callback
      )
      .subscribe();

    this.subscriptions.set(channelId, { channel, count: 1 });

    return () => this.unsubscribe(channelId);
  }

  private unsubscribe(channelId: string) {
    const subscription = this.subscriptions.get(channelId);
    if (!subscription) return;

    subscription.count--;

    if (subscription.count === 0) {
      // No more subscribers, clean up the subscription
      subscription.channel.unsubscribe();
      this.subscriptions.delete(channelId);
    } else {
      // Update the reference count
      this.subscriptions.set(channelId, subscription);
    }
  }

  // Subscribe to reactions for a specific message
  subscribeToReactions(messageId: string, callback: (payload: any) => void) {
    const channel = supabase
      .channel(`message-${messageId}-reactions`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reactions',
          filter: `message_id=eq.${messageId}`,
        },
        callback
      )
      .subscribe();

    return () => channel.unsubscribe();
  }

  // Subscribe to thread updates
  subscribeToThread(parentMessageId: string, callback: (payload: any) => void) {
    const channel = supabase
      .channel(`thread-${parentMessageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `parent_id=eq.${parentMessageId}`,
        },
        callback
      )
      .subscribe();

    return () => channel.unsubscribe();
  }
}

// Export a singleton instance
export const subscriptionManager = new SubscriptionManager();
