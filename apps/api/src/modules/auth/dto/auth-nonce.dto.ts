import { IsEthereumAddress, IsInt, Min } from 'class-validator';

export class AuthNonceDto {
  @IsEthereumAddress()
  address!: string;

  @IsInt()
  @Min(1)
  chainId!: number;
}
