import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
/** Restrict a route to one or more roles: `@Roles('WAREHOUSE_MANAGER')`. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC_KEY = 'isPublic';
/** Mark a route as not requiring authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
