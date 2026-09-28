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
  events: {
    async createUser({ user }) {
      if (user.email && compedEmails().has(user.email.toLowerCase())) {
        await prisma.user.update({ where: { id: user.id }, data: { comped: true } });
      }
    },
  },
});
