export const offices = {
  "david-city-ne": {
    slug: "david-city-ne",
    name: "David City",
    state: "Nebraska",
    timezone: "America/Chicago",
    coordinates: { latitude: 41.2528, longitude: -97.1301 },
    nearbyObservationStation: "KOLU",
    radarViewport: { west: -101.0, east: -94.2, south: 39.85, north: 42.8 },
    radarLabel: "Eastern Nebraska composite",
    nwrOffice: "Omaha / Valley",
    hourlyForecastUrl: "https://api.weather.gov/gridpoints/OAX/42,60/forecast/hourly",
    locationNote: "Live observation from Columbus Municipal Airport (KOLU), the nearest reliable NWS station."
  }
};

export function getOffice() {
  const segment = location.pathname.split("/").filter(Boolean).pop();
  return offices[segment] || offices["david-city-ne"];
}
