import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { TheonexusPrismaAdapter } from "@/lib/authAdapter";
import { compedEmails } from "@/lib/comped";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: TheonexusPrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    // JWT-strategy sessions don't include the user id on session.user by
    // default — the (gated) layout and Stripe routes key off session.user.id,
    // so it has to be copied over from the token explicitly.
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.email && compedEmails().has(user.email.toLowerCase())) {
        await prisma.user.update({ where: { id: user.id }, data: { comped: true } });
      }
    },
  },
});
