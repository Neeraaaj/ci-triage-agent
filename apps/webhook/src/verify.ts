import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySignature(secret: string, rawBody: string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) {
        return false;
    }

    const expectedSignature = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
    const expectedBuffer = Buffer.from(expectedSignature);
    const actualBuffer = Buffer.from(signatureHeader);

    if (expectedBuffer.length !== actualBuffer.length) {
        return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
}