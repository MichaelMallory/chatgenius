export interface MessageData {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  channel_id: string;
  parent_id: string | null;
  files: {
    id: string;
    name: string;
    size: number;
    type: string;
    url: string;
  }[];
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

export interface ThreadPosition {
  messageId: string;
  top: number;
  right: number;
}

export interface MessageListProps {
  channelId: string;
}
