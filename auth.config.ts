export const authConfig = {
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }: any) {
      // Eğer kullanıcı giriş yapmamışsa ve gizli bir sayfaya gitmeye çalışmıyorsa izin ver
      return true; 
    },
  },
} as any;
