export const authConfig = {
  providers: [],
  callbacks: {
    authorized({ auth }: any) {
      return true; 
    },
  },
} as any;
