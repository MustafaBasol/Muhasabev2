import type { Request } from 'express';
import type { User } from '../../users/entities/user.entity';

// Explicit request shape injected by Passport so we can type req.user everywhere.
export interface AuthenticatedRequest extends Request {
  user: User;
}
