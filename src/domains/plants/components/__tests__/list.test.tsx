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

  // El chip dice el porcentaje de la plantación entera; cuánto lleva cada
  // captura lo enseña su propia tarjeta.
  it("renders progress chip when there is progress", async () => {
    const item = buildPlant();
    const { getByText } = await render(<PlantCard item={item} />);

    expect(getByText("10 %")).toBeOnTheScreen();
  });

  it("renders zero in the progress chip without progress", async () => {
    const item = buildPlant({ progress: 0 });
    const { getByText } = await render(<PlantCard item={item} />);

    expect(getByText("0 %")).toBeOnTheScreen();
  });

  it("renders sync chip", async () => {
    const item = buildPlant();
    const { getByText } = await render(<PlantCard item={item} />);

    expect(getByText("Sinc. pendiente")).toBeOnTheScreen();
  });

  // La señal por chip dice **cuál** falta por mandar, que es lo que el chip de
  // la tarjeta no puede decir. Se comprueba por la etiqueta y no por el icono
  // porque es lo mismo que oiría un lector de pantalla.
  it("marks which tratamiento is pending to sync", async () => {
    const item = buildPlant({ tratamientosPending: ["trat-2"] });
    const { getByLabelText, queryByLabelText } = await render(
      <PlantCard item={item} />,
    );

    expect(
      getByLabelText("Trat 2, pendiente de sincronizar"),
    ).toBeOnTheScreen();
    expect(queryByLabelText("Trat 1, pendiente de sincronizar")).toBeNull();
    expect(getByLabelText("Trat 1")).toBeOnTheScreen();
  });

  it("marks which post-cosecha evaluation is pending to sync", async () => {
    const item = buildPlant({ postcosechaPending: ["30caja"] });
    const { getByLabelText } = await render(<PlantCard item={item} />);

    expect(
      getByLabelText("30 días Caja, pendiente de sincronizar"),
    ).toBeOnTheScreen();
    expect(getByLabelText("15 días Caja")).toBeOnTheScreen();
  });

  // El caso que antes no podía existir: el chip miraba `syncStatus`, que el
  // mapper del pull escribe siempre como `synced`, así que no aparecía nunca.
  // Ahora mira lo que de verdad queda sin mandar, y eso puede ser nada.
  it("hides the sync chip when nothing is left to send", async () => {
    const item = buildPlant({ pendingSync: false });
    const { queryByText } = await render(<PlantCard item={item} />);

    expect(queryByText("Sinc. pendiente")).toBeNull();
  });
});
