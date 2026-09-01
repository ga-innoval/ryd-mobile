export const formatDownloadSummary = (count: number) => {
  const verb = count === 1 ? "ha" : "han";
  const noun = count === 1 ? "plantación" : "plantaciones";

  return `Se ${verb} actualizado ${count} ${noun}.`;
};
