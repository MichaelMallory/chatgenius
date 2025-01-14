export interface Channel {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  isDirectMessage: boolean;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
  lastMessageAt?: Date;
}
