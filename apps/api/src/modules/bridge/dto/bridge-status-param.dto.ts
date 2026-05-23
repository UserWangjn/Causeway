import { IsString, Length } from 'class-validator';

export class BridgeStatusParamDto {
  @IsString()
  @Length(20, 128)
  address!: string;
}
