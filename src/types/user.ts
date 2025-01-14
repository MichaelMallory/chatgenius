export interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  fullName?: string;
  createdAt: Date;
  updatedAt?: Date;
  lastSeen?: Date;
  isOnline?: boolean;
}
