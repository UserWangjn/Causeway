import { IsEthereumAddress, IsInt, IsString, Min } from 'class-validator';

export class AuthVerifyDto {
  @IsEthereumAddress()
  address!: string;

  @IsInt()
  @Min(1)
  chainId!: number;

  @IsString()
  message!: string;

  @IsString()
  signature!: string;
}
