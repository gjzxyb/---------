import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { prisma } from "@/lib/db";
import { UserStatus } from "@/lib/generated/prisma/enums";
import { loadAdminSettings } from "@/lib/admin/settings-store";
import { verifyPassword } from "@/lib/auth/password";
import {
  isLoginLimited,
  recordAndCheckLoginFailure,
  resetLoginFailures,
} from "@/lib/cache/safety";

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        if (await isLoginLimited(email)) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            mustChangePassword: true,
            role: true,
            status: true,
            organizationId: true,
          },
        });

        if (!user || user.status !== UserStatus.ACTIVE) {
          await recordAndCheckLoginFailure(email);
          return null;
        }

        const validPassword = await verifyPassword(password, user.passwordHash);

        if (!validPassword) {
          await recordAndCheckLoginFailure(email);
          return null;
        }

        await resetLoginFailures(email);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          mustChangePassword: user.mustChangePassword,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.mustChangePassword = user.mustChangePassword;
        token.role = user.role;
        token.organizationId = user.organizationId;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const [settings, currentUser] = await Promise.all([
          loadAdminSettings(),
          token.id
            ? prisma.user.findUnique({
                where: { id: token.id },
                select: { mustChangePassword: true },
              })
            : null,
        ]);

        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.mustChangePassword =
          settings.requireFirstLoginPasswordChange &&
          (currentUser?.mustChangePassword ?? token.mustChangePassword ?? false);
        session.user.role = token.role;
        session.user.organizationId = token.organizationId;
      }

      return session;
    },
  },
};
