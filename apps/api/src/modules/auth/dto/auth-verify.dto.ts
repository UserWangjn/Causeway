import { IsEthereumAddress, IsInt, IsString, MaxLength, Min } from 'class-validator';

export class AuthVerifyDto {
  @IsEthereumAddress()
  address!: string;

  @IsInt()
  @Min(1)
  chainId!: number;

  @IsString()
  @MaxLength(2048)
  message!: string;

  @IsString()
  @MaxLength(256)
  signature!: string;
}
