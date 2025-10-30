import NextAuth, { type AuthOptions, User } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { JWT } from "next-auth/jwt"

// Define your required scopes
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar"
const GOOGLE_MAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"

/**
 * Takes a token, and returns a new token with updated
 * `accessToken` and `accessTokenExpires`. If an error occurs,
 * returns the old token and an error property
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const url = "https://oauth2.googleapis.com/token"
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID as string,
        client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    }
  } catch (error) {
    console.error("Error refreshing access token:", error)
    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: `openid email profile ${GOOGLE_CALENDAR_SCOPE} ${GOOGLE_MAIL_SCOPE}`,
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        return {
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : undefined,
          refreshToken: account.refresh_token,
          user: user,
        }
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token
      }

      // Access token has expired, try to update it
      // ** THIS IS THE NEW LOGIC **
      if (token.refreshToken) {
        return refreshAccessToken(token)
      }
      
      // If no refresh token, return error
      return { ...token, error: "RefreshAccessTokenError" }
    },

    async session({ session, token }) {
      if (token) {
        session.user = token.user as any // Be careful with 'any' in production
        session.accessToken = token.accessToken
        session.error = token.error
        session.refreshToken = token.refreshToken
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }