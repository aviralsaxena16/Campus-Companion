// In frontend/app/api/auth/[...nextauth]/route.ts

import NextAuth, { type AuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

// Define your required scopes
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar"
const GOOGLE_MAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"

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
    // This callback saves token data into the JWT
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : undefined
        token.user = user
        return token
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token
      }

      // Access token has expired, try to update it
      // TODO: A full production app would use the refreshToken 
      // to get a new accessToken from Google here.
      
      // We've confirmed this works, so we remove the console.error
      // console.error("Access token expired. User needs to re-authenticate.") 
      
      token.error = "RefreshAccessTokenError"
      return token
    },
    
    // This callback makes the token data available to the client-side session
    async session({ session, token }) {
      if (token) {
        session.user = token.user
        session.accessToken = token.accessToken
        session.error = token.error
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }