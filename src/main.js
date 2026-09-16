import "./style.css";
import { getOffice } from "./offices.js";

const office = getOffice();
const RADAR_HOST = "https://mesonet.agron.iastate.edu";
const NWS_HOST = "https://api.weather.gov";
const RADAR_REFRESH_MS = 5 * 60 * 1000;
const RADAR_FRAME_MS = 900;
const DATA_REFRESH_MS = 10 * 60 * 1000;
const RADAR_BOUNDS = { west: -126, east: -66, south: 24, north: 50 };
const BOUNDARY_DATA_URL = `${import.meta.env.BASE_URL}boundaries-nebraska-region.json`;
const $ = (selector) => document.querySelector(selector);
const FORECAST_ROTATION_MS = 20 * 1000;
let weatherSources;
let forecastView = "hourly";
let forecastRotationTimer;

document.title = `${office.name} Weather Display`;
$("#app").innerHTML = `
  <main class="slide" aria-label="${office.name} weather display">
    <header class="masthead">
      <div class="display-identity"><span class="identity-mark"></span><span>REGIONAL WEATHER</span></div>
      <div class="headline"><span class="eyebrow">LOCAL WEATHER</span><strong>${office.name}, ${office.state}</strong></div>
      <time id="clock" class="clock"></time>
    </header>
    <section class="content">
      <section class="conditions panel" aria-label="Current conditions">
        <div class="panel-label">CURRENT CONDITIONS</div>
        <div id="temperature" class="temperature">--<span>°</span></div>
        <div id="condition" class="condition">Loading NOAA observation…</div>
        <div class="observation">
          <div><span>WIND</span><strong id="wind">--</strong></div>
          <div><span>HUMIDITY</span><strong id="humidity">--</strong></div>
        </div>
        <p id="observation-note" class="source-note">Locating the nearest official observation station…</p>
      </section>
      <section class="radar panel" aria-label="Animated precipitation radar">
        <div class="radar-heading">
          <div><div class="panel-label">PRECIPITATION RADAR</div><strong>${office.name} regional composite</strong></div>
          <div id="radar-status" class="data-status loading">Loading frames</div>
        </div>
        <div id="radar-map" class="radar-map">
          <div class="map-grid"></div>
          <img id="radar-image" alt="Latest NEXRAD precipitation radar mosaic centered on ${office.name}, ${office.state}" />
          <svg id="geographic-overlay" class="geographic-overlay" viewBox="0 0 1200 520" preserveAspectRatio="none" aria-label="Geographic overlay centered on ${office.name}, ${office.state}"></svg>
          <div id="geography-status" class="geography-status">BORDERS LOADING</div>
          <div class="radar-legend"><span>LIGHT</span><i></i><i></i><i></i><i></i><span>HEAVY</span></div>
        </div>
        <div class="radar-footer"><span id="frame-time">Awaiting radar imagery</span><span>NOAA NEXRAD mosaic via Iowa Environmental Mesonet</span></div>
      </section>
      <aside class="forecast panel" aria-label="Forecast">
        <div class="forecast-heading"><div id="forecast-title" class="panel-label">NEXT HOURS</div><div id="forecast-status" class="data-status loading">Loading</div></div>
        <div id="forecast-slots" class="forecast-slots" aria-live="polite"><div class="forecast-loading">Loading ${office.name} point forecast…</div></div>
        <div class="forecast-footer"><span id="forecast-source">OFFICIAL ${office.name.toUpperCase()} POINT FORECAST</span><span id="forecast-updated">NWS SOURCE LOADING</span></div>
      </aside>
    </section>
    <footer class="footer"><span id="system-status">DATA: CONNECTING</span><span>WEATHER AWARENESS DISPLAY — CHECK OFFICIAL ALERTS</span><span id="last-refresh">--</span></footer>
  </main>
`;

function celsiusToFahrenheit(value) {
  return value === null || value === undefined ? null : Math.round((value * 9) / 5 + 32);
}

function radarViewport() {
  const halfLongitude = office.radar.windowDegrees.longitude / 2;
  const halfLatitude = office.radar.windowDegrees.latitude / 2;
  return {
    west: office.coordinates.longitude - halfLongitude,
    east: office.coordinates.longitude + halfLongitude,
    south: office.coordinates.latitude - halfLatitude,
    north: office.coordinates.latitude + halfLatitude
  };
}

function radarSupported() {
  const viewport = radarViewport();
  return office.radar.coverage === "iem-conus"
    && viewport.west >= RADAR_BOUNDS.west && viewport.east <= RADAR_BOUNDS.east
    && viewport.south >= RADAR_BOUNDS.south && viewport.north <= RADAR_BOUNDS.north;
}

function formatWind(speed, direction) {
  if (speed === null || speed === undefined) return "Calm / --";
  const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round((direction || 0) / 45) % 8];
  return `${Math.round(speed * 2.237)} mph ${compass}`;
}

function stamp() {
  return new Intl.DateTimeFormat("en-US", { timeZone: office.timezone, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).format(new Date());
}

function zoneName(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone: office.timezone, timeZoneName: "short" })
    .formatToParts(date).find((part) => part.type === "timeZoneName").value;
}

function updateClock() {
  $("#clock").textContent = `${stamp()} ${zoneName()}`;
}

function fitSlideToViewport() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  const width = 1920 * scale;
  const height = 1080 * scale;
  Object.assign($(".slide").style, {
    transform: `translate(${(window.innerWidth - width) / 2}px, ${(window.innerHeight - height) / 2}px) scale(${scale})`
  });
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/geo+json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function miles(meters) {
  return `${Math.round(meters / 1609.344)} mi`;
}

async function initializeWeatherSources() {
  const pointUrl = `${NWS_HOST}/points/${office.coordinates.latitude},${office.coordinates.longitude}`;
  const point = await fetchJson(pointUrl);
  const props = point.properties;
  const stations = await fetchJson(props.observationStations);
  const nearestStation = stations.features
    .filter((station) => station.properties?.stationIdentifier)
    .sort((a, b) => a.properties.distance.value - b.properties.distance.value)[0];
  if (!nearestStation) throw new Error("NWS point returned no observation stations");
  weatherSources = {
    daily: props.forecast,
    hourly: props.forecastHourly,
    office: props.forecastOffice.split("/").pop(),
    station: nearestStation.properties,
    observation: `${NWS_HOST}/stations/${nearestStation.properties.stationIdentifier}/observations/latest`
  };
  const officeName = props.forecastOffice.split("/").pop();
  $("#observation-note").textContent = `Current observation: ${weatherSources.station.name} (${weatherSources.station.stationIdentifier}), ${miles(weatherSources.station.distance.value)} from ${office.name}.`;
  $("#forecast-source").textContent = `OFFICIAL ${office.name.toUpperCase()} POINT FORECAST`;
  $("#forecast-updated").textContent = `ISSUED BY NWS ${officeName}`;
}

async function loadWeather() {
  try {
    const [observation, hourlyForecast, dailyForecast] = await Promise.all([
      fetchJson(weatherSources.observation),
      fetchJson(weatherSources.hourly),
      fetchJson(weatherSources.daily)
    ]);
    const props = observation.properties;
    const fahrenheit = celsiusToFahrenheit(props.temperature?.value);
    $("#temperature").innerHTML = fahrenheit === null ? "--<span>°</span>" : `${fahrenheit}<span>°</span>`;
    $("#condition").textContent = props.textDescription || "Conditions unavailable";
    $("#wind").textContent = formatWind(props.windSpeed?.value, props.windDirection?.value);
    $("#humidity").textContent = props.relativeHumidity?.value === null ? "--" : `${Math.round(props.relativeHumidity.value)}%`;
    $("#observation-note").textContent = `Current observation: ${weatherSources.station.name} (${weatherSources.station.stationIdentifier}), ${miles(weatherSources.station.distance.value)} from ${office.name}. Observed ${new Date(props.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: office.timezone })} ${zoneName(new Date(props.timestamp))}.`;

    const periods = upcomingFullHourPeriods(hourlyForecast.properties.periods || [], new Date());
    if (periods.length === 4) {
      cachedHourlyPeriods = periods;
      cachedDailyPeriods = dailyForecast.properties.periods || [];
      forecastView = "hourly";
      renderForecastView(cachedHourlyPeriods, cachedDailyPeriods);
      startForecastRotation();
      $("#forecast-status").textContent = "Live";
      $("#forecast-status").className = "data-status live";
      $("#forecast-updated").textContent = `ISSUED ${new Date(hourlyForecast.properties.updateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: office.timezone })} ${zoneName()} · NWS ${weatherSources.office}`;
    } else {
      throw new Error(`NWS supplied only ${periods.length} future full-hour periods`);
    }
    $("#system-status").textContent = "DATA: LIVE NOAA / NWS";
    $("#last-refresh").textContent = `UPDATED ${stamp()} ${zoneName()}`;
  } catch (error) {
    $("#condition").textContent = "NOAA conditions unavailable";
    $("#forecast-slots").innerHTML = `<div class="forecast-loading error-copy">${office.name} point forecast needs four future full-hour periods. Retrying automatically.</div>`;
    $("#forecast-status").textContent = "Retrying";
    $("#forecast-status").className = "data-status error";
    $("#forecast-updated").textContent = "NWS RETRYING";
    $("#system-status").textContent = "DATA: NWS RETRYING";
    console.warn("NWS weather request failed:", error);
  }
}

function upcomingFullHourPeriods(periods, now) {
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  const futurePeriods = periods.filter((period) => new Date(period.endTime) > now);
  return futurePeriods.filter((period) => new Date(period.startTime) >= nextHour).slice(0, 4);
}

function timingCue(period) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: office.timezone, hour: "numeric", hourCycle: "h23" }).format(new Date(period.startTime)));
  if (hour < 6) return "OVERNIGHT";
  if (hour < 12) return "THIS MORNING";
  if (hour < 17) return "THIS AFTERNOON";
  if (hour < 21) return "EARLY EVENING";
  return "TONIGHT";
}

function weatherSymbol(shortForecast) {
  const condition = (shortForecast || "").toLowerCase();
  if (condition.includes("thunder")) return "⚡";
  if (condition.includes("snow") || condition.includes("flurr") || condition.includes("sleet") || condition.includes("ice")) return "❄";
  if (condition.includes("rain") || condition.includes("shower") || condition.includes("drizzle")) return "☂";
  if (condition.includes("fog") || condition.includes("haze") || condition.includes("smoke")) return "≋";
  if (condition.includes("wind")) return "≋";
  if (condition.includes("cloud") || condition.includes("overcast")) return condition.includes("partly") || condition.includes("mostly") ? "⛅" : "☁";
  return "☀";
}

function forecastIcon(period) {
  const label = period.shortForecast || "Weather forecast";
  return `<span class="forecast-icon" role="img" aria-label="${label}">${weatherSymbol(label)}</span>`;
}

function enableConditionMarquees() {
  document.querySelectorAll(".condition-clip").forEach((clip) => {
    const text = clip.firstElementChild;
    if (text.scrollWidth > clip.clientWidth) {
      const distance = text.scrollWidth - clip.clientWidth;
      text.style.setProperty("--marquee-distance", `-${distance}px`);
      text.classList.add("condition-marquee");
    }
  });
}

function renderHourlyForecast(periods) {
  return periods.slice(0, 4).map((period) => {
    const time = new Intl.DateTimeFormat("en-US", { timeZone: office.timezone, hour: "numeric", hour12: true }).format(new Date(period.startTime));
    const precipitation = period.probabilityOfPrecipitation?.value;
    const chance = precipitation === null || precipitation === undefined ? "--" : `${precipitation}%`;
    return `<article class="forecast-slot hourly-slot">
      <time>${time}<small>${timingCue(period)}</small></time>${forecastIcon(period)}
      <strong>${period.temperature}°</strong><span class="condition-clip"><span>${period.shortForecast}</span></span>
      <span class="hourly-detail">PRECIP ${chance} · ${period.windDirection} ${period.windSpeed}</span>
    </article>`;
  }).join("");
}

function renderDailyForecast(periods) {
  const days = periods.filter((period) => period.isDaytime).slice(0, 4);
  return days.map((period) => {
    const day = new Intl.DateTimeFormat("en-US", { timeZone: office.timezone, weekday: "short" }).format(new Date(period.startTime)).toUpperCase();
    const precipitation = period.probabilityOfPrecipitation?.value;
    const chance = precipitation === null || precipitation === undefined ? "--" : `${precipitation}%`;
    return `<article class="forecast-slot daily-slot">
      <time>${day}</time>${forecastIcon(period)}
      <strong>${period.temperature}°</strong><span class="condition-clip"><span>${period.shortForecast}</span></span>
      <span class="hourly-detail">PRECIP ${chance} · ${period.windDirection} ${period.windSpeed}</span>
    </article>`;
  }).join("");
}

function renderForecastView(hourlyPeriods, dailyPeriods) {
  $("#forecast-title").textContent = forecastView === "hourly" ? "NEXT HOURS" : "NEXT DAYS";
  $("#forecast-slots").classList.remove("forecast-fade");
  void $("#forecast-slots").offsetWidth;
  $("#forecast-slots").classList.add("forecast-fade");
  $("#forecast-slots").innerHTML = forecastView === "hourly" ? renderHourlyForecast(hourlyPeriods) : renderDailyForecast(dailyPeriods);
  requestAnimationFrame(enableConditionMarquees);
}

let cachedHourlyPeriods = [];
let cachedDailyPeriods = [];

function startForecastRotation() {
  clearInterval(forecastRotationTimer);
  forecastRotationTimer = setInterval(() => {
    if (!cachedHourlyPeriods.length || !cachedDailyPeriods.length) return;
    forecastView = forecastView === "hourly" ? "daily" : "hourly";
    renderForecastView(cachedHourlyPeriods, cachedDailyPeriods);
  }, FORECAST_ROTATION_MS);
}

function radarUrl(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const stamp = `${yyyy}${mm}${dd}${hh}${min}`;
  return `${RADAR_HOST}/archive/data/${yyyy}/${mm}/${dd}/GIS/uscomp/n0r_${stamp}.png`;
}

function radarTime(date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: office.timezone, hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function applyRadarCrop() {
  const viewport = radarViewport();
  const width = ((RADAR_BOUNDS.east - RADAR_BOUNDS.west) / (viewport.east - viewport.west)) * 100;
  const height = ((RADAR_BOUNDS.north - RADAR_BOUNDS.south) / (viewport.north - viewport.south)) * 100;
  const left = -((viewport.west - RADAR_BOUNDS.west) / (RADAR_BOUNDS.east - RADAR_BOUNDS.west)) * width;
  const top = -((RADAR_BOUNDS.north - viewport.north) / (RADAR_BOUNDS.north - RADAR_BOUNDS.south)) * height;
  Object.assign($("#radar-image").style, { width: `${width}%`, height: `${height}%`, left: `${left}%`, top: `${top}%` });
}

function project([longitude, latitude]) {
  const viewport = radarViewport();
  return [
    ((longitude - viewport.west) / (viewport.east - viewport.west)) * 1200,
    ((viewport.north - latitude) / (viewport.north - viewport.south)) * 520
  ];
}

function coordinatesToPath(coordinates) {
  return coordinates.map((ring) => ring.map((point, index) => {
    const [x, y] = project(point);
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join("") + "Z").join("");
}

function geometryToPath(geometry) {
  if (geometry.type === "Polygon") return coordinatesToPath(geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map(coordinatesToPath).join("");
  return "";
}

function geometryTouchesViewport(geometry) {
  const visit = (coordinates) => coordinates.some((entry) => {
    if (typeof entry[0] === "number") {
      const viewport = radarViewport();
      return entry[0] >= viewport.west && entry[0] <= viewport.east
        && entry[1] >= viewport.south && entry[1] <= viewport.north;
    }
    return visit(entry);
  });
  return visit(geometry.coordinates);
}

function overlaps(candidate, placed) {
  return placed.some((label) => candidate.x < label.x + label.width + 8
    && candidate.x + candidate.width + 8 > label.x
    && candidate.y < label.y + label.height + 4
    && candidate.y + candidate.height + 4 > label.y);
}

function cityLabels() {
  const positions = [[10, -10], [10, 16], [-10, -10], [-10, 16], [44, -10], [44, 16], [-44, -10], [-44, 16]];
  const [officeX, officeY] = project([office.coordinates.longitude, office.coordinates.latitude]);
  const placed = [{ x: officeX + 10, y: officeY - 38, width: 110, height: 28 }];
  return (office.nearbyCities || []).slice().sort((a, b) => b[3] - a[3]).filter(([, longitude, latitude]) => {
    const [x, y] = project([longitude, latitude]);
    return Math.hypot(x - officeX, y - officeY) > 90;
  }).map(([name, longitude, latitude]) => {
    const [x, y] = project([longitude, latitude]);
    const width = name.length * 7.2 + 8;
    const choices = positions.map(([dx, dy]) => ({ x: x + dx - (dx < 0 ? width : 0), y: y + dy - 10, width, height: 15, dx, dy }));
    const choice = choices.find((item) => !overlaps(item, placed)) || choices.reduce((best, item) => (
      placed.filter((label) => overlaps(item, [label])).length < placed.filter((label) => overlaps(best, [label])).length ? item : best
    ));
    placed.push(choice);
    return `<g class="city-label"><circle cx="${x}" cy="${y}" r="2.7"/><path d="M${x},${y} L${choice.x + (choice.dx < 0 ? choice.width : 0)},${choice.y + 9}"/><text x="${choice.x}" y="${choice.y + 10}">${name.toUpperCase()}</text></g>`;
  }).join("");
}

function renderGeographicOverlay(states, counties) {
  const visibleStatePaths = states
    .filter(geometryTouchesViewport)
    .map((state) => `<path class="state-boundary" d="${geometryToPath(state)}"/>`).join("");
  const nebraskaCountyPaths = counties
    .map((county) => `<path class="county-boundary" d="${geometryToPath(county)}"/>`).join("");
  const [officeX, officeY] = project([office.coordinates.longitude, office.coordinates.latitude]);
  $("#geographic-overlay").innerHTML = `${visibleStatePaths}${nebraskaCountyPaths}${cityLabels()}<g class="office-marker"><path d="M${officeX},${officeY} L${officeX + 12},${officeY - 24}"/><circle cx="${officeX}" cy="${officeY}" r="9"/><circle cx="${officeX}" cy="${officeY}" r="3.5"/><text x="${officeX + 16}" y="${officeY - 27}">${office.name.toUpperCase()}</text></g>`;
}

async function loadGeographicOverlay() {
  if (office.boundaryOverlay !== "nebraska") {
    $("#geography-status").textContent = "REGIONAL BORDERS NOT CONFIGURED";
    return;
  }
  try {
    const boundaries = await fetchJson(BOUNDARY_DATA_URL);
    renderGeographicOverlay(boundaries.states, boundaries.counties);
    $("#geography-status").remove();
  } catch (error) {
    $("#geography-status").textContent = "BORDERS UNAVAILABLE";
    $("#geography-status").classList.add("error");
    console.warn("Census boundary request failed:", error);
  }
}

function loadImage(url, date) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ url, date });
    image.onerror = () => reject(new Error("Radar frame unavailable"));
    image.src = url;
  });
}

let radarFrames = [];
let frameIndex = 0;
let playbackTimer;

function playRadar() {
  clearInterval(playbackTimer);
  if (!radarFrames.length) return;
  const render = () => {
    const frame = radarFrames[frameIndex];
    $("#radar-image").src = frame.url;
    $("#frame-time").textContent = `RADAR FRAME: ${radarTime(frame.date)} CT`;
    frameIndex = (frameIndex + 1) % radarFrames.length;
  };
  render();
  playbackTimer = setInterval(render, RADAR_FRAME_MS);
}

async function loadRadar() {
  if (!radarSupported()) {
    $("#radar-status").textContent = "Radar not available";
    $("#radar-status").className = "data-status error";
    $("#frame-time").textContent = `IEM NEXRAD covers the contiguous U.S.; configure another radar source for ${office.name}.`;
    return;
  }
  $("#radar-status").textContent = "Updating radar";
  $("#radar-status").className = "data-status loading";
  const latest = new Date(Date.now() - 10 * 60 * 1000);
  latest.setUTCMinutes(Math.floor(latest.getUTCMinutes() / 5) * 5, 0, 0);
  const requested = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(latest.getTime() - (7 - index) * 5 * 60 * 1000);
    return loadImage(radarUrl(date), date);
  });
  const settled = await Promise.allSettled(requested);
  radarFrames = settled.filter(({ status }) => status === "fulfilled").map(({ value }) => value);
  frameIndex = 0;
  if (radarFrames.length >= 2) {
    $("#radar-status").textContent = `${radarFrames.length} frames live`;
    $("#radar-status").className = "data-status live";
    playRadar();
  } else {
    clearInterval(playbackTimer);
    $("#radar-image").removeAttribute("src");
    $("#radar-status").textContent = "Radar unavailable";
    $("#radar-status").className = "data-status error";
    $("#frame-time").textContent = "No recent NEXRAD frames loaded — retrying automatically.";
  }
}

applyRadarCrop();
loadGeographicOverlay();
fitSlideToViewport();
window.addEventListener("resize", fitSlideToViewport, { passive: true });
updateClock();
setInterval(updateClock, 1000);
initializeWeatherSources().then(loadWeather).catch((error) => {
  $("#condition").textContent = "NOAA sources unavailable";
  $("#forecast-slots").innerHTML = `<div class="forecast-loading error-copy">${office.name} weather sources unavailable. Retrying automatically.</div>`;
  $("#forecast-status").textContent = "Retrying";
  $("#forecast-status").className = "data-status error";
  console.warn("NWS source discovery failed:", error);
});
loadRadar();
setInterval(() => {
  if (weatherSources) loadWeather();
  else initializeWeatherSources().then(loadWeather).catch((error) => console.warn("NWS source discovery retry failed:", error));
}, DATA_REFRESH_MS);
setInterval(loadRadar, RADAR_REFRESH_MS);
