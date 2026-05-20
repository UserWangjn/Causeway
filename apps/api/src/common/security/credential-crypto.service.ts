import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

@Injectable()
export class CredentialCryptoService {
  private readonly rawKey?: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.rawKey = config.get<string>('security.credentialEncryptionKey')?.trim() || undefined;
  }

  encrypt(value: string): string {
    const key = this.resolveKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return ['v1', encode(iv), encode(tag), encode(ciphertext)].join(':');
  }

  decrypt(value: string): string {
    const key = this.resolveKey();
    const [version, ivRaw, tagRaw, ciphertextRaw] = value.split(':');
    if (version !== 'v1' || !ivRaw || !tagRaw || !ciphertextRaw) {
      throw new ServiceUnavailableException({
        code: 'CREDENTIAL_DECRYPTION_FAILED',
        message: 'Stored Polymarket credentials use an unsupported encryption envelope',
      });
    }

    const decipher = createDecipheriv(ALGORITHM, key, decode(ivRaw));
    decipher.setAuthTag(decode(tagRaw));
    return Buffer.concat([decipher.update(decode(ciphertextRaw)), decipher.final()]).toString('utf8');
  }

  isConfigured(): boolean {
    return Boolean(this.rawKey);
  }

  private resolveKey(): Buffer {
    if (!this.rawKey) {
      throw new ServiceUnavailableException({
        code: 'CAPABILITY_UNAVAILABLE',
        message: 'CREDENTIAL_ENCRYPTION_KEY is required before storing user Polymarket credentials',
      });
    }

    const fromBase64 = tryDecode(this.rawKey, 'base64');
    if (fromBase64?.length === 32) return fromBase64;

    const fromHex = /^[a-fA-F0-9]{64}$/.test(this.rawKey) ? Buffer.from(this.rawKey, 'hex') : null;
    if (fromHex?.length === 32) return fromHex;

    return createHash('sha256').update(this.rawKey, 'utf8').digest();
  }
}

function encode(value: Buffer): string {
  return value.toString('base64url');
}

function decode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function tryDecode(value: string, encoding: BufferEncoding): Buffer | null {
  try {
    return Buffer.from(value, encoding);
  } catch {
    return null;
  }
}
