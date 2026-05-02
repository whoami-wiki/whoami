export interface User {
  username: string;
  passwordHash: string;
}

export interface Session {
  id: string;
  userId: string;
  csrf: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthContext {
  user: User;
  csrf: string;
}
