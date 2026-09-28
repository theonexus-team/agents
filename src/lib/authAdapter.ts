import type { PrismaClient, User as PrismaUser } from "@prisma/client";
import type { Adapter, AdapterUser } from "@auth/core/adapters";

/**
 * Hand-written Adapter instead of @auth/prisma-adapter: that package hardcodes
 * `prisma.account`/`prisma.session` calls with no remapping option, and both
 * names are already taken here (Account = per-client trading dashboard config,
 * Session = the trading-session enum). This maps to the renamed OAuthAccount/
 * AuthSession models instead. Session methods are included only so the Adapter
 * type is fully satisfied — unused while NextAuth's session strategy is "jwt"
 * (see src/lib/authjs.ts).
 */

// AdapterUser requires `email: string`; the Prisma column is nullable to keep
// the schema generic, but the only provider wired up is Google, which always
// supplies a verified email — safe to assert here, never at the DB layer.
function toAdapterUser(user: PrismaUser): AdapterUser {
  return { ...user, email: user.email ?? "" };
}

export function TheonexusPrismaAdapter(prisma: PrismaClient): Adapter {
  return {
    async createUser({ id: _id, ...data }) {
      return toAdapterUser(await prisma.user.create({ data }));
    },
    async getUser(id) {
      const user = await prisma.user.findUnique({ where: { id } });
      return user ? toAdapterUser(user) : null;
    },
    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({ where: { email } });
      return user ? toAdapterUser(user) : null;
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const account = await prisma.oAuthAccount.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true },
      });
      return account ? toAdapterUser(account.user) : null;
    },
    async updateUser({ id, ...data }) {
      return toAdapterUser(await prisma.user.update({ where: { id }, data }));
    },
    async linkAccount(data) {
      await prisma.oAuthAccount.create({ data });
    },
    async unlinkAccount({ provider, providerAccountId }) {
      await prisma.oAuthAccount.delete({
        where: { provider_providerAccountId: { provider, providerAccountId } },
      });
    },
    async getSessionAndUser(sessionToken) {
      const row = await prisma.authSession.findUnique({
        where: { sessionToken },
        include: { user: true },
      });
      if (!row) return null;
      const { user, ...session } = row;
      return { user: toAdapterUser(user), session };
    },
    async createSession(data) {
      return prisma.authSession.create({ data });
    },
    async updateSession(data) {
      return prisma.authSession.update({ where: { sessionToken: data.sessionToken }, data });
    },
    async deleteSession(sessionToken) {
      await prisma.authSession.delete({ where: { sessionToken } });
    },
  };
}
