import { render, userEvent, waitFor } from "@testing-library/react-native";
import { LoginForm } from "../login-form";
import { useLogin } from "../../hooks/useLogin";
import { router } from "expo-router";

jest.mock("../../hooks/useLogin", () => ({
  useLogin: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
}));

describe("<LoginForm />", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows validation messages with empty fields", async () => {
    (useLogin as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
      error: null,
    });

    const user = userEvent.setup();
    const { getByText, findByText } = await render(<LoginForm />);

    await user.press(getByText("Iniciar sesión"));

    expect(await findByText("El usuario es requerido")).toBeTruthy();
    expect(await findByText("La contraseña es requerida")).toBeTruthy();
  });

  it("shows error message returned by useLogin()", async () => {
    (useLogin as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
      error: new Error("Usuario o contraseña incorrectos"),
    });

    const { findByText } = await render(<LoginForm />);

    expect(await findByText("Usuario o contraseña incorrectos")).toBeTruthy();
  });

  it("disables button while isPending is true", async () => {
    const mutateMock = jest.fn();

    (useLogin as jest.Mock).mockReturnValue({
      mutate: mutateMock,
      isPending: true,
      error: null,
    });

    const user = userEvent.setup();
    const { getByText } = await render(<LoginForm />);

    await user.press(getByText("Iniciando..."));

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("redirects to home on sucessfull login", async () => {
    const mutateMock = jest.fn((_data, options) => {
      options.onSuccess();
    });

    (useLogin as jest.Mock).mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      error: null,
    });

    const user = userEvent.setup();
    const { getByPlaceholderText, getByText } = await render(<LoginForm />);

    await user.type(getByPlaceholderText("Tu nombre de usuario"), "a-user");
    await user.type(getByPlaceholderText("*******"), "a-password");
    await user.press(getByText("Iniciar sesión"));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });
});
