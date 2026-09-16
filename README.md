# PosterBooking Weather Display

A no-key, static weather-signage slide for GitHub Pages and PosterBooking. The first office route is **David City, Nebraska**.

## Production URL and routing

After enabling GitHub Pages from the repository's **GitHub Actions** source, the direct signage URL is:

`https://hyst16.github.io/weather-tv-display/david-city-ne/`

The app uses a real path route (not hash routing). The included Pages workflow writes a fallback copy of `index.html` to `david-city-ne/index.html`, so direct loads and signage webviews do not require server-side SPA rewrites.

In PosterBooking, create a Web Page / Website screen, paste that exact URL, set the screen to landscape 16:9, and enable its fullscreen/kiosk option if available. Do not use a cached screenshot or an embedded iframe. Set the screen refresh/reload interval to 15–30 minutes as a recovery measure for long-running signage browsers.

## Deploying

1. Push this branch to GitHub and merge it into `main`.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. The [Pages workflow](.github/workflows/deploy-pages.yml) builds and deploys every push to `main`.
4. Wait for the Pages deployment to complete, then open the URL above once to confirm it renders.

Local development:

```sh
npm install
npm run dev
```

`npm run build` produces the static `dist/` deployment bundle.

## Data sources, reliability, and limitations

The slide requests current observation and forecast data from the keyless [NWS API](https://www.weather.gov/documentation/services-web-api), and NEXRAD reflectivity mosaics from the [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu/docs/nexrad_composites/). IEM documents that its mosaics are generated from NEXRAD Level III products every five minutes. Eight completed archive slots are requested with a 10-minute safety delay; successfully loaded frames animate automatically every 900 ms. Radar refreshes every five minutes and NWS content every ten minutes.

Radar geographic overlays are projected directly into the IEM raster's documented EPSG:4326 extent. State and Nebraska-only county boundaries come from the repository-hosted `public/boundaries-nebraska-region.json` extract of the U.S. Census Bureau Cartographic Boundary Files (via [us-atlas](https://github.com/topojson/us-atlas)); they are not manually drawn. This compact same-origin extract contains only the seven states visible around Nebraska and Nebraska's 93 counties, avoiding a runtime map-service dependency. City locations for all Nebraska municipalities at roughly 10,000+ residents are rendered with a deterministic priority/collision strategy. David City remains the distinct red office marker. If the boundary asset fails to load, the slide labels the overlay unavailable while keeping the radar animation active.

No credentials, API keys, server, or Windy dependency are used. Both remote public services can be rate-limited, unavailable, delayed, changed, or blocked by a restrictive signage network/CSP. The slide visibly identifies loading, unavailable radar, and NWS retry states rather than substituting fabricated weather. It must not be used as an official warning source; keep the NWS/official-alert disclaimer visible.

## Adding offices

Add an entry to `src/offices.js` with its route slug, coordinates, closest reliable NWS observation station, NWS forecast grid URL, time zone, and radar viewport. The shared application selects an entry from the last path segment. For a new direct GitHub Pages path, add that slug to the `mkdir`/copy step in `.github/workflows/deploy-pages.yml` (or replace it with a generated loop).

The visual canvas is always **1920×1080 logical pixels**. CSS scales it uniformly using the smaller browser dimension, centers it in any viewport, and sets `overflow: hidden` at every root level; it does not assume a desktop-sized viewport and produces no document scrollbars.

The David City display uses an eastern-Nebraska radar viewport (`101°W–94.2°W`, `39.85°N–42.8°N`) to provide room around the office while retaining nearby Iowa, Kansas, and South Dakota context. The IEM source raster and overlay geometry are both WGS84/EPSG:4326, so state/county/city features are projected into that exact extent. It first resolves NWS point `41.2528,-97.1301`, which NWS identifies as David City, NE, then follows that response's `forecast`, `forecastHourly`, and `observationStations` URLs. The forecast panel autonomously cross-fades every 20 seconds between three large hourly slots and four daily slots. Hourly signage uses the next full local hour, filtering out periods already ended or in progress; each precipitation chance remains tied to that NWS period's exact displayed hour. Forecast cards use local, accessible weather glyphs derived from the NWS condition text, avoiding remote raster icon loading. Only overflowing condition text slowly pauses and scrolls; reduced-motion settings disable it. It selects the nearest official station from the point response, displays its name/ID/distance and observation time, and refreshes NWS data every ten minutes.
