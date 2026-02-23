export const authConfig = {
  providers: [], // Middleware için burası boş kalmalı
  callbacks: {
    authorized({ auth }: any) {
      return !!auth; // Giriş yapmamışsa korunan sayfalara sokmaz
    },
  },
} as any;
