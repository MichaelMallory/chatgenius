import { openDB, IDBPDatabase } from 'idb';
import { MessageData } from '@/components/chat/types';

const DB_NAME = 'chat_cache';
const MESSAGE_STORE = 'messages';
const CACHE_VERSION = 1;

class MessageCache {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = this.initDB();
  }

  private async initDB() {
    return openDB(DB_NAME, CACHE_VERSION, {
      upgrade(db) {
        // Create a store of messages
        const store = db.createObjectStore(MESSAGE_STORE, {
          keyPath: 'id',
        });
        // Create indexes for faster queries
        store.createIndex('channel_id', 'channel_id');
        store.createIndex('created_at', 'created_at');
      },
    });
  }

  async cacheMessages(channelId: string, messages: MessageData[]) {
    const db = await this.db;
    const tx = db.transaction(MESSAGE_STORE, 'readwrite');
    const store = tx.objectStore(MESSAGE_STORE);

    // Cache each message
    await Promise.all(messages.map((message) => store.put(message)));
    await tx.done;
  }

  async getCachedMessages(channelId: string): Promise<MessageData[]> {
    const db = await this.db;
    const tx = db.transaction(MESSAGE_STORE, 'readonly');
    const store = tx.objectStore(MESSAGE_STORE);
    const channelIndex = store.index('channel_id');

    const messages = await channelIndex.getAll(channelId);
    return messages.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  async updateMessage(message: MessageData) {
    const db = await this.db;
    const tx = db.transaction(MESSAGE_STORE, 'readwrite');
    const store = tx.objectStore(MESSAGE_STORE);
    await store.put(message);
    await tx.done;
  }

  async deleteMessage(messageId: string) {
    const db = await this.db;
    const tx = db.transaction(MESSAGE_STORE, 'readwrite');
    const store = tx.objectStore(MESSAGE_STORE);
    await store.delete(messageId);
    await tx.done;
  }

  async clearChannelCache(channelId: string) {
    const db = await this.db;
    const tx = db.transaction(MESSAGE_STORE, 'readwrite');
    const store = tx.objectStore(MESSAGE_STORE);
    const channelIndex = store.index('channel_id');

    const messages = await channelIndex.getAllKeys(channelId);
    await Promise.all(messages.map((key) => store.delete(key)));
    await tx.done;
  }
}

// Export a singleton instance
export const messageCache = new MessageCache();
