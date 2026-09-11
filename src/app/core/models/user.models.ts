import { Grade, PublicationStatus } from './catalog.models';

export type UserRole = 'BUYER_SELLER' | 'TECHNICAL_AGENT' | 'WORKSHOP_ADMIN';

// Resumen de una publicación del vendedor, resuelto por ms-user contra
// publication-service (ver Dto.PublicationSummary en el backend).
export interface UserPublicationSummary {
  publicationId: string;
  title: string;
  price: number;
  grade: Grade;
  status: PublicationStatus;
  primaryImage: string | null;
  createdAt: string;
}

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
  publicationsCount: number;
  publications: UserPublicationSummary[];
}

export interface UpdateProfileRequest {
  fullName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  address?: string | null;
}
