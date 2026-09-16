export const offices = {
  "david-city-ne": {
    slug: "david-city-ne",
    name: "David City",
    state: "Nebraska",
    timezone: "America/Chicago",
    coordinates: { latitude: 41.2528, longitude: -97.1301 },
    nearbyObservationStation: "KOLU",
    radarViewport: { west: -105.5, east: -93.5, south: 39.3, north: 44.4 },
    radarLabel: "Nebraska regional composite",
    nwrOffice: "Omaha / Valley",
    locationNote: "Live observation from Columbus Municipal Airport (KOLU), the nearest reliable NWS station."
  }
};

export function getOffice() {
  const segment = location.pathname.split("/").filter(Boolean).pop();
  return offices[segment] || offices["david-city-ne"];
}
