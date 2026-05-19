import { Transform } from 'class-transformer';

export function TrimString(): PropertyDecorator {
  return Transform(({ value }) => {
    const input: unknown = value;
    return typeof input === 'string' ? input.trim() : input;
  });
}
