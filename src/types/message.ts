import { type User } from './user';
import { type Channel } from './channel';

export interface Message {
  id: string;
  content: string;
  user: User;
  channel: Channel;
  createdAt: Date;
  updatedAt?: Date;
  parentId?: string;
  threadId?: string;
}
