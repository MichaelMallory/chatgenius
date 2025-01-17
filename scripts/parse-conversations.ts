import fs from 'fs';
import path from 'path';

interface ParsedMessage {
  username: string;
  content: string;
  timestamp?: string;
  reactions?: string[];
}

export function parseConversations(conversationsDir: string) {
  const channelMessages: Record<string, ParsedMessage[]> = {};

  // Read all conversation files
  const files = fs.readdirSync(conversationsDir);
  for (const file of files) {
    if (file.endsWith('.txt')) {
      const channelName = file.replace('.txt', '').toLowerCase();
      const filePath = path.join(conversationsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse messages
      const messages: ParsedMessage[] = [];
      const lines = content.split('\n').filter((line) => line.trim());

      let currentMessage: Partial<ParsedMessage> = {};

      for (const line of lines) {
        const match = line.match(/^(.*?):\s*(.*)$/);
        if (match) {
          if (currentMessage.username) {
            messages.push(currentMessage as ParsedMessage);
          }
          currentMessage = {
            username: match[1].toLowerCase().trim(),
            content: match[2].trim(),
            reactions: [], // Initialize empty reactions array
          };
        } else if (currentMessage.username) {
          currentMessage.content += '\n' + line.trim();
        }
      }

      // Add the last message
      if (currentMessage.username) {
        messages.push(currentMessage as ParsedMessage);
      }

      channelMessages[channelName] = messages;
    }
  }

  return channelMessages;
}
