const crypto = require("crypto");
const algorithm = "aes-256-ctr";

const secretKey = process.env.ENCRYPTION_KEY; // Should be 32 bytes (256 bits)

if (!secretKey) {
  throw new Error("ENCRYPTION_KEY environment variable is not set");
}

if (Buffer.from(secretKey).length !== 32) {
  throw new Error("ENCRYPTION_KEY must be 32 bytes (256 bits) long");
}

function encrypt(text) {
  const iv = crypto.randomBytes(16); // 16-byte IV for AES-256-CTR
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);

  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(hash) {
  const [ivHex, encryptedTextHex] = hash.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encryptedText = Buffer.from(encryptedTextHex, "hex");
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);

  return decrypted.toString("utf8");
}

module.exports = { encrypt, decrypt };
