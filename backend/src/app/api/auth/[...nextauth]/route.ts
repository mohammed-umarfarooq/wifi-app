import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import * as argon2 from "argon2";


export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username }
        });

        if (!user) {
          // If no users exist in the DB, and this matches initial setup credentials, create the admin
          const count = await prisma.user.count();
          if (count === 0 && credentials.username === process.env.ADMIN_INITIAL_USERNAME) {
            if (credentials.password === process.env.ADMIN_INITIAL_PASSWORD) {
              const hashedPassword = await argon2.hash(credentials.password);
              const newUser = await prisma.user.create({
                data: {
                  username: credentials.username,
                  password: hashedPassword,
                  role: "ADMIN"
                }
              });
              return { id: newUser.id, name: newUser.username, role: newUser.role };
            }
          }
          return null;
        }

        const isPasswordValid = await argon2.verify(user.password, credentials.password);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.username,
          role: user.role,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    }
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
