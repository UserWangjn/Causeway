import { SetMetadata } from '@nestjs/common';

export const IS_INTERNAL_ROUTE = 'causeway:isInternalRoute';

export const InternalRoute = () => SetMetadata(IS_INTERNAL_ROUTE, true);
