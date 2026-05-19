import { HttpException, HttpStatus } from '@nestjs/common';

export type ApiExceptionBody = {
  code: string;
  message: string;
  details?: unknown;
};

export class ApiException extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, details?: unknown) {
    super(
      {
        code,
        message,
        details,
      } satisfies ApiExceptionBody,
      status,
    );
  }
}
