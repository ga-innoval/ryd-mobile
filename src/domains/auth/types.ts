export interface TokenPair {
  token: {
    access: string;
    refresh: string;
  };
}

export interface User {
  id: string;
  fullName: string;
  username: string;
  initials: string;
}

interface RemoteUser extends Omit<User, "fullName"> {
  first_name: string;
  last_name: string;
}

export type LoginResponse = TokenPair & RemoteUser;
