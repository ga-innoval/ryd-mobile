const currentYear = new Date().getFullYear();

export const app = {
  name: "Captura Experimental",
  version: "0.1.0",
  developer: `Innoval. Grupo Alta ${currentYear}`,
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_URL ?? "https://api.gainnoval.com/api",
};
