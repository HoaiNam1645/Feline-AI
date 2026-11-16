function dateParts(now: Date, timeZone: string): [number, number, number] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error(`Cannot resolve ${type} in ${timeZone}`);
    return Number(value);
  };

  return [get("year"), get("month"), get("day")];
}

export function previousLocalDate(now: Date, timeZone: string): string {
  const [year, month, day] = dateParts(now, timeZone);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}
