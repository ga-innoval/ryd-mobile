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
  /**
   * Los ids de los campos a los que el usuario tiene acceso, tal como los
   * devuelve el login. Es lo que filtra el listado de plantaciones: la tablet
   * puede compartirse y un usuario no debe ver plantaciones de campos que no son
   * suyos, aunque estén en su base local.
   */
  campos: number[];
}

interface RemoteUser extends Omit<User, "fullName"> {
  first_name: string;
  last_name: string;
}

export type LoginResponse = TokenPair & RemoteUser;
