# Weather TV Display

A keyless, static, 16:9 weather-signage slide for GitHub Pages and website-based TV players. Each slide is selected by a readable configured path, for example:

`https://hyst16.github.io/weather-tv-display/david-city-ne/`

Only **David City, Nebraska** is configured initially. The app is intentionally configuration-led: it does not claim that an arbitrary URL represents a business location.

## Add a city slide

1. Add one entry to [`src/offices.json`](src/offices.json), keyed by a unique URL-safe `slug`.
2. Provide the city display `name`, full `state`, two-letter `stateCode`, WGS84 `coordinates`, IANA `timezone`, and `radar` configuration. Coordinates are the authoritative input—obtain and verify them before adding a location.
3. For IEM NEXRAD coverage, retain `"coverage": "iem-conus"` and the supplied `windowDegrees`. The app centers this fixed 6.8° longitude × 2.95° latitude visual window on the configured coordinates.
4. Optionally set `boundaryOverlay` and `nearbyCities` only when a matching local boundary asset is included. The current `nebraska` overlay is intentionally specific to David City.
5. Commit and push to `main`. `npm run build` reads the JSON and creates `dist/<slug>/index.html` for every configured office, making direct loads and refreshes work on GitHub Pages.

The configuration schema is:

```json
{
  "city-state-slug": {
    "slug": "city-state-slug",
    "name": "City",
    "state": "State",
    "stateCode": "ST",
    "coordinates": { "latitude": 0, "longitude": 0 },
    "timezone": "Area/City",
    "radar": {
      "coverage": "iem-conus",
      "windowDegrees": { "longitude": 6.8, "latitude": 2.95 }
    },
    "boundaryOverlay": "optional-known-overlay",
    "nearbyCities": []
  }
}
```

## Data and coverage

For every configured office, the browser requests `https://api.weather.gov/points/<latitude>,<longitude>`. It then follows **that response's** `forecast`, `forecastHourly`, and `observationStations` URLs. The nearest station in the returned official station list supplies current conditions and its human-readable name, station ID, distance, and observation time are displayed. Forecast attribution identifies the configured city point forecast and the NWS issuing office returned by the point metadata.

Current wind is explicitly labeled **Sustained Wind**. The app converts the NWS `windSpeed` using its returned `unitCode` (`km/h`, `m/s`, knots, or mph) and only shows a numeric speed for a finite, non-negative recognized measurement. A valid gust is appended only when NWS supplies one that exceeds sustained wind; missing, unknown-unit, or invalid values render as `Unavailable`, not a plausible number.

Hourly signage displays exactly four periods starting with the next full local hour; if NWS temporarily provides fewer than four, the panel clearly says it is retrying rather than silently showing a partial set. The panel cross-fades every 20 seconds between the four-hour and four-day views. Local accessible condition glyphs, timing cues, and overflow-only marquee text remain independent of remote image assets.

Animated radar uses Iowa Environmental Mesonet's keyless NEXRAD mosaic archive, refreshed every five minutes, with eight recent frames. Its raster is WGS84/EPSG:4326 and is projected with the computed office-centered viewport. This provider is supported only where the requested window fits its **contiguous U.S.** extent (24°–50°N, 126°–66°W). Locations outside it show an actionable “Radar not available” message; the app does not fabricate worldwide coverage. NWS forecast availability is also U.S. and territory dependent. Public services can be delayed, changed, rate-limited, or blocked by signage networks; loading, error, and stale/retry states are visible.

## Deploy and display

1. In GitHub **Settings → Pages**, choose **GitHub Actions** as the source.
2. Merge or push the change to `main`; `.github/workflows/deploy-pages.yml` runs `npm ci` and `npm run build`, then deploys the generated static paths.
3. In PosterBooking or another website signage player, configure a landscape 16:9 Website/Web Page screen with the exact configured URL, such as the David City URL above. Prefer kiosk/fullscreen mode and a 15–30 minute player reload as a recovery measure.

The slide is a fixed 1920×1080 logical canvas. It uses JavaScript to uniformly scale and center itself for any browser or fullscreen-webview dimensions with root overflow disabled, so it does not depend on a desktop viewport and does not introduce document scrollbars. This is an awareness display, not an official warning source; keep official-alert procedures in place.

## Development

```sh
npm install
npm run build
npm run dev
```

The build output includes the root entry page plus one static direct route per configured office.
