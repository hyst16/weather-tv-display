const MPH_PER_KILOMETER_PER_HOUR = 0.621371;
const MPH_PER_METER_PER_SECOND = 2.236936;
const MPH_PER_KNOT = 1.150779;

export function milesPerHour(measurement) {
  const value = measurement?.value;
  if (!Number.isFinite(value) || value < 0) return null;
  switch (measurement.unitCode) {
    case "wmoUnit:km_h-1":
      return value * MPH_PER_KILOMETER_PER_HOUR;
    case "wmoUnit:m_s-1":
      return value * MPH_PER_METER_PER_SECOND;
    case "wmoUnit:kn":
      return value * MPH_PER_KNOT;
    case "wmoUnit:mph":
      return value;
    default:
      return null;
  }
}

export function formatObservedWind(windSpeed, windDirection, windGust) {
  const speed = milesPerHour(windSpeed);
  if (speed === null) return "Unavailable";
  const direction = Number.isFinite(windDirection?.value)
    ? ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(windDirection.value / 45) % 8]
    : "Variable";
  const gust = milesPerHour(windGust);
  const gustText = gust !== null && gust > speed ? ` · Gust ${Math.round(gust)} mph` : "";
  return `${Math.round(speed)} mph ${direction}${gustText}`;
}
