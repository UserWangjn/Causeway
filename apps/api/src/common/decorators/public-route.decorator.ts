import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_ROUTE = 'causeway:isPublicRoute';

export const PublicRoute = () => SetMetadata(IS_PUBLIC_ROUTE, true);
