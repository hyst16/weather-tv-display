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

No credentials, API keys, server, or Windy dependency are used. Both remote public services can be rate-limited, unavailable, delayed, changed, or blocked by a restrictive signage network/CSP. The slide visibly identifies loading, unavailable radar, and NWS retry states rather than substituting fabricated weather. It must not be used as an official warning source; keep the NWS/official-alert disclaimer visible. The nearby KOLU observation is used because David City does not have a configured NWS observation station in this static configuration.

## Adding offices

Add an entry to `src/offices.js` with its route slug, coordinates, closest reliable NWS observation station, NWS forecast grid URL, time zone, and radar viewport. The shared application selects an entry from the last path segment. For a new direct GitHub Pages path, add that slug to the `mkdir`/copy step in `.github/workflows/deploy-pages.yml` (or replace it with a generated loop).

The visual canvas is always **1920×1080 logical pixels**. CSS scales it uniformly using the smaller browser dimension, centers it in any viewport, and sets `overflow: hidden` at every root level; it does not assume a desktop-sized viewport and produces no document scrollbars.
