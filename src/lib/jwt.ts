// src/lib/jwt.ts
import { sign, verify } from "hono/jwt";

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_TOKEN_EXPIRY = 60 * 60 * 8; // 8 hours — user re-logs in after expiry

export interface TokenPayload {
  sub: string; // users.id (UUID)
  memberId: string; // members.id (UUID)
  nim: string;
  roles: string[]; // e.g. ["finance"] or ["member"]
  mustChangePassword: boolean;
  exp: number;
}

export async function signAccessToken(payload: Omit<TokenPayload, "exp">): Promise<string> {
  return sign(
    { ...payload, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY },
    JWT_SECRET,
    "HS256",
  );
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const decoded = await verify(token, JWT_SECRET, "HS256");
  return decoded as unknown as TokenPayload;
}
