export const authConfig = {
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }: any) {
      const isLoggedIn = !!auth?.user;
      const isOnSignIn = nextUrl.pathname.startsWith('/sign-in');
      const isOnSignUp = nextUrl.pathname.startsWith('/sign-up');

      // 1. Eğer giriş sayfasındaysa ve zaten giriş yapmışsa ana sayfaya at
      if ((isOnSignIn || isOnSignUp) && isLoggedIn) {
        return Response.redirect(new URL('/', nextUrl));
      }

      // 2. Eğer giriş sayfasındaysa ama giriş yapmamışsa, sayfaya girmesine izin ver (DÖNGÜYÜ BURASI KIRAR)
      if (isOnSignIn || isOnSignUp) {
        return true;
      }

      // 3. Diğer her durumda (herkes her yeri görebilsin şimdilik)
      return true; 
    },
  },
} as any;;
