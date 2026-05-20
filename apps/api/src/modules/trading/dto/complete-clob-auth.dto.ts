import { IsInt, IsString, IsUUID, Max, Min, Matches } from 'class-validator';

export class CompleteClobAuthDto {
  @IsUUID()
  challengeId!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  nonce!: number;

  @IsInt()
  @Min(1_700_000_000)
  timestamp!: number;

  @IsString()
  @Matches(/^0x[a-fA-F0-9]{130,4096}$/)
  signature!: string;
}
