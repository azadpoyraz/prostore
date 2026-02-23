export const authConfig = {
  providers: [],
  callbacks: {
    authorized({ auth }: any) {
      return !!auth;
    },
  },
};