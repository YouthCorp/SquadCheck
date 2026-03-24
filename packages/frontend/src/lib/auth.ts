import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { decodeJwt, SignJWT } from 'jose';
import { prisma } from './prisma';

const API_TOKEN_ISSUER = 'squadcheck-frontend';
const API_TOKEN_AUDIENCE = 'squadcheck-api';
const API_TOKEN_TTL = '15m';
const API_TOKEN_REFRESH_WINDOW_SECONDS = 5 * 60;

function shouldRefreshApiToken(apiToken: unknown): boolean {
  if (typeof apiToken !== 'string' || !apiToken) return true;

  try {
    const payload = decodeJwt(apiToken);
    if (typeof payload.exp !== 'number') return true;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp - now <= API_TOKEN_REFRESH_WINDOW_SECONDS;
  } catch {
    return true;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.AUTH_EMAIL_FROM ?? 'noreply@squadcheck.xyz',
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tier = (user as any).tier ?? 'free';
      }

      // Keep the browser session long-lived, but rotate the API token frequently.
      if (token.userId && shouldRefreshApiToken(token.apiToken)) {
        const authSecret = process.env.AUTH_SECRET;
        if (!authSecret) {
          throw new Error('AUTH_SECRET is required to mint API tokens');
        }

        const secret = new TextEncoder().encode(authSecret);
        token.apiToken = await new SignJWT({
          userId: token.userId,
          tier: token.tier ?? 'free',
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setIssuer(API_TOKEN_ISSUER)
          .setAudience(API_TOKEN_AUDIENCE)
          .setExpirationTime(API_TOKEN_TTL)
          .sign(secret);
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string;
        (session.user as any).tier = token.tier as string;
        (session as any).accessToken = token.apiToken as string;
      }
      return session;
    },
  },
  pages: { signIn: '/' }, // modal 방식 — 별도 페이지 없음
});
