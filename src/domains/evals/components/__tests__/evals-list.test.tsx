import { render } from "@testing-library/react-native";
import { EvaluacionCard } from "../evals-list";
import { EVALS_POST_COSECHA } from "../../lib/evals-post-cosecha";
import { SyncStatus } from "../../types";

const buildEvaluacion = (overrides = {}) => ({
  id: "eval-1",
  name: "1004-Freedom",
  campo: "Pozo Manuel",
  cuadro: "1A",
  programa: "Temprano",
  patron: "Freedom",
  anio: 2026,
  tratamientos: [{ name: "Trat 1" }, { name: "Trat 2" }, { name: "Trat 3" }],
  progress: 0.1,
  syncStatus: SyncStatus.PEN,
  ...overrides,
});

describe("<EvaluacionCard />", () => {
  it("renders eval data correctly", async () => {
    const item = buildEvaluacion();
    const { getByText } = await render(<EvaluacionCard item={item} />);

    expect(getByText("1004-Freedom")).toBeOnTheScreen();

    expect(getByText("Campo")).toBeOnTheScreen();
    expect(getByText("Pozo Manuel")).toBeOnTheScreen();

    expect(getByText("Cuadro")).toBeOnTheScreen();
    expect(getByText("1A")).toBeOnTheScreen();

    expect(getByText("Programa")).toBeOnTheScreen();
    expect(getByText("Temprano")).toBeOnTheScreen();

    expect(getByText("Patrón")).toBeOnTheScreen();
    expect(getByText("Freedom")).toBeOnTheScreen();

    expect(getByText("Año")).toBeOnTheScreen();
    expect(getByText("2026")).toBeOnTheScreen();
  });

  it("renders tratamiento items", async () => {
    const item = buildEvaluacion({
      tratamiento: [{ name: "A" }, { name: "B" }, { name: "C" }],
    });

    const { getByText } = await render(<EvaluacionCard item={item} />);

    expect(getByText("1")).toBeOnTheScreen();
    expect(getByText("2")).toBeOnTheScreen();
    expect(getByText("3")).toBeOnTheScreen();
  });

  it("renders message if no tratamientos", async () => {
    const item = buildEvaluacion({ tratamientos: [] });
    const { getByText, queryByText } = await render(
      <EvaluacionCard item={item} />,
    );

    expect(queryByText("1")).not.toBeOnTheScreen();
    expect(getByText("Sin tratamientos configurados")).toBeOnTheScreen();
  });

  it("renders post-cosecha items", async () => {
    const item = buildEvaluacion();
    const { getByTestId } = await render(<EvaluacionCard item={item} />);

    EVALS_POST_COSECHA.forEach(({ id }) => {
      expect(getByTestId(`post-cosecha-${id}`)).toBeOnTheScreen();
    });
  });

  it("renders progress chip", async () => {
    const item = buildEvaluacion();
    const { getByText } = await render(<EvaluacionCard item={item} />);

    expect(getByText("10% completado")).toBeOnTheScreen();
  });

  it("renders status chip", async () => {
    const item = buildEvaluacion();
    const { getByText } = await render(<EvaluacionCard item={item} />);

    expect(getByText("Pendiente")).toBeOnTheScreen();
  });
});
