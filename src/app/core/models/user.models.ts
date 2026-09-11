export type UserRole = 'BUYER_SELLER' | 'TECHNICAL_AGENT' | 'WORKSHOP_ADMIN';

export interface UserResponse {
  userId: string;
  username: string;
  email: string;
  fullName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  address: string | null;
  role: UserRole;
  createdAt: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  address?: string | null;
}
