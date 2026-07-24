import "server-only";
import crypto from "crypto";

/** Symmetric encryption for stored access credentials. AES-256-GCM with a
 *  key derived from the ACCESS_SECRET_KEY env var. The output is base64 of
 *  iv(12) | authTag(16) | ciphertext, so it round-trips as a single string. */

function key(): Buffer {
  const raw = process.env.ACCESS_SECRET_KEY;
  if (!raw) {
    throw new Error(
      "ACCESS_SECRET_KEY is not set — cannot encrypt/decrypt access credentials.",
    );
  }
  // Accept any-length secret; derive a stable 32-byte key.
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}

/** True when a usable encryption key is configured (for graceful UI hints). */
export function hasSecretKey(): boolean {
  return !!process.env.ACCESS_SECRET_KEY;
}
