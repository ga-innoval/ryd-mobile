export const secureStorage = {
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  setTokens: jest.fn(),
  clearTokens: jest.fn(),
};

export const storage = {
  setUser: jest.fn(),
  getUser: jest.fn(),
  clearUser: jest.fn(),
};
