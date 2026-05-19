import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrimString } from '../../../common/decorators/trim-string.decorator';

export class OrderIntentParamDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  intentId!: string;
}
