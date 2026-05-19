import { ValidationPipe, type Type } from '@nestjs/common';

export function createDtoValidationPipe<T extends object>(expectedType: Type<T>): ValidationPipe {
  return new ValidationPipe({
    expectedType,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}
