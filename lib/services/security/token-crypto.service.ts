import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { AppError } from "@/lib/core/errors";

const ALGORITHM = "aes-256-gcm";
const VERSION_PREFIX = "enc:v1:";

export class TokenCryptoService {
  private readonly key: Buffer;

  constructor(secret: string) {
    // Derive a stable 32-byte key from any high-entropy app secret.
    this.key = createHash("sha256").update(secret).digest();
  }

  public encryptIfNeeded(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    if (value.startsWith(VERSION_PREFIX)) {
      return value;
    }

    return this.encrypt(value);
  }

  public decryptIfNeeded(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    if (!value.startsWith(VERSION_PREFIX)) {
      return value;
    }

    try {
      return this.decrypt(value);
    } catch (error) {
      // If decryption fails (key mismatch, corrupt data, etc), return the value as-is
      // This allows graceful degradation when encryption keys change
      console.warn(
        `[TokenCryptoService] Decryption failed for encrypted token, returning as-is. Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return value;
    }
  }

  private encrypt(plainText: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${VERSION_PREFIX}${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
  }

  private decrypt(serialized: string): string {
    const payload = serialized.slice(VERSION_PREFIX.length);
    const [ivPart, tagPart, dataPart] = payload.split(".");

    if (!ivPart || !tagPart || !dataPart) {
      throw new AppError(
        "TOKEN_DECRYPT_INVALID",
        "Encrypted token format is invalid. Expected format: enc:v1:base64.base64.base64",
        500,
      );
    }

    try {
      const iv = Buffer.from(ivPart, "base64");
      const authTag = Buffer.from(tagPart, "base64");
      const encrypted = Buffer.from(dataPart, "base64");

      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString("utf8");
    } catch (error) {
      // Common causes: wrong encryption key, corrupted token, algorithm mismatch
      const message =
        error instanceof Error
          ? error.message
          : "Unknown decryption error";
      throw new AppError(
        "TOKEN_DECRYPT_FAILED",
        `Failed to decrypt token. Likely causes: encryption key mismatch, corrupted token data. Details: ${message}`,
        500,
      );
    }
  }
}
