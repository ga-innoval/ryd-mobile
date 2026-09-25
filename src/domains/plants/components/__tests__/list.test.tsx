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

  // El chip dice el estatus y no el porcentaje: cuánto lleva cada tratamiento
  // ya lo enseña su propia barra.
  it("renders status chip as started when there is progress", async () => {
    const item = buildPlant();
    const { getByText } = await render(<PlantCard item={item} />);

    expect(getByText("Iniciada")).toBeOnTheScreen();
  });

  it("renders status chip as not started without progress", async () => {
    const item = buildPlant({ progress: 0 });
    const { getByText } = await render(<PlantCard item={item} />);

    expect(getByText("Sin iniciar")).toBeOnTheScreen();
  });

  it("renders sync chip", async () => {
    const item = buildPlant();
    const { getByText } = await render(<PlantCard item={item} />);

    expect(getByText("Pendiente")).toBeOnTheScreen();
  });
});
