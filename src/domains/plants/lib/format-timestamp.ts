import {
  format,
  formatDistanceToNow,
  differenceInYears,
  formatDistanceToNowStrict,
} from "date-fns";
import { es } from "date-fns/locale";

export const formatTimestamp = (lastSyncedAt: number) => {
  const date = new Date(lastSyncedAt);

  const yearsDiff = differenceInYears(new Date(), date);

  if (yearsDiff >= 1) {
    return format(date, "PP", { locale: es });
  }

  return formatDistanceToNowStrict(date, { locale: es, addSuffix: true });
};
