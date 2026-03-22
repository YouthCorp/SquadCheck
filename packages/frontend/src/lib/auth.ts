import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { SignJWT } from 'jose';
import { prisma } from './prisma';

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
      // Mint a HS256 API token once for Express API auth (jwtVerify-compatible).
      // Stored in the encrypted NextAuth cookie; re-created only if absent.
      if (!token.apiToken && token.userId) {
        const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
        token.apiToken = await new SignJWT({ userId: token.userId, tier: token.tier ?? 'free' })
          .setProtectedHeader({ alg: 'HS256' })
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
