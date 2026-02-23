import NextAuth from 'next-auth';
// auth.config'den değil, içindeki dolu olan config'in olduğu auth.ts'den çekmeli
import { config as authConfig } from './auth'; 

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};


