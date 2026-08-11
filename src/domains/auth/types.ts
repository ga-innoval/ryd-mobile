export interface TokenPair {
  token: {
    access: string;
    refresh: string;
  };
}

export interface User {
  id: number;
  name: string;
  username: string;
  initials: string;
}

export type LoginResponse = TokenPair & User;
