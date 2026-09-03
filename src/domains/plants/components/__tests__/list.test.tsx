import { render } from "@testing-library/react-native";
import { PlantCard } from "../list";
import { EVALS_POST_COSECHA } from "../../lib/evals-post-cosecha";
import { buildPlant } from "@/test-utils/factories/plant.factory";
import { buildTratamiento } from "@/test-utils/factories/tratamiento.factory";

describe("<PlantCard />", () => {
  it("renders eval data correctly", async () => {
    const item = buildPlant();
    const { getByText } = await render(<PlantCard item={item} />);

    expect(getByText("1004-Freedom")).toBeOnTheScreen();

    expect(getByText("Campo")).toBeOnTheScreen();
    expect(getByText("pozo manuel")).toBeOnTheScreen();

    expect(getByText("Cuadro")).toBeOnTheScreen();
    expect(getByText("1a")).toBeOnTheScreen();

    expect(getByText("Programa")).toBeOnTheScreen();
    expect(getByText("temprano")).toBeOnTheScreen();

    expect(getByText("Patrón")).toBeOnTheScreen();
    expect(getByText("freedom")).toBeOnTheScreen();

    expect(getByText("Año")).toBeOnTheScreen();
    expect(getByText("2026")).toBeOnTheScreen();
  });

  it("renders tratamiento items", async () => {
    const item = buildPlant({
      tratamientos: [
        buildTratamiento({ id: "a", name: "A" }),
        buildTratamiento({ id: "b", name: "B" }),
        buildTratamiento({ id: "c", name: "C" }),
      ],
    });

    const { getByText } = await render(<PlantCard item={item} />);

    expect(getByText("A")).toBeOnTheScreen();
    expect(getByText("B")).toBeOnTheScreen();
    expect(getByText("C")).toBeOnTheScreen();
  });

  it("renders message if no tratamientos", async () => {
    const item = buildPlant({ tratamientos: [] });
    const { getByText, queryByText } = await render(<PlantCard item={item} />);

    expect(queryByText("1")).not.toBeOnTheScreen();
    expect(getByText("Sin tratamientos configurados")).toBeOnTheScreen();
  });

  it("renders post-cosecha items", async () => {
    const item = buildPlant();
    const { getByTestId } = await render(<PlantCard item={item} />);

    EVALS_POST_COSECHA.forEach(({ id }) => {
      expect(getByTestId(`post-cosecha-${id}`)).toBeOnTheScreen();
    });
  });

  it("renders progress chip", async () => {
    const item = buildPlant();
    const { getByText } = await render(<PlantCard item={item} />);

    expect(getByText("10% completado")).toBeOnTheScreen();
  });

  it("renders status chip", async () => {
    const item = buildPlant();
    const { getByText } = await render(<PlantCard item={item} />);

    expect(getByText("Pendiente")).toBeOnTheScreen();
  });
});
