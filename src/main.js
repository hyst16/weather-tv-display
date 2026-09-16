import "./style.css";
import { getOffice } from "./offices.js";

const office = getOffice();
const RADAR_HOST = "https://mesonet.agron.iastate.edu";
const NWS_HOST = "https://api.weather.gov";
const RADAR_REFRESH_MS = 5 * 60 * 1000;
const RADAR_FRAME_MS = 900;
const DATA_REFRESH_MS = 10 * 60 * 1000;
const $ = (selector) => document.querySelector(selector);

document.title = `${office.name} Weather | PosterBooking`;
$("#app").innerHTML = `
  <main class="slide" aria-label="${office.name} weather display">
    <header class="masthead">
      <div class="brand"><span class="brand-mark">PB</span><span>POSTERBOOKING<span class="dot">.UK</span></span></div>
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
        <p id="observation-note" class="source-note">${office.locationNote}</p>
      </section>
      <section class="radar panel" aria-label="Animated precipitation radar">
        <div class="radar-heading">
          <div><div class="panel-label">PRECIPITATION RADAR</div><strong>${office.radarLabel}</strong></div>
          <div id="radar-status" class="data-status loading">Loading frames</div>
        </div>
        <div id="radar-map" class="radar-map">
          <div class="map-grid"></div>
          <img id="radar-image" alt="Latest NEXRAD precipitation radar mosaic focused on Nebraska" />
          <svg class="state-outline" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
            <path d="M4 6 L22 5 L39 8 L55 9 L73 10 L94 12 L95 34 L77 33 L60 35 L43 35 L25 37 L6 36 Z" />
          </svg>
          <div class="location-pin"><i></i><span>DAVID CITY</span></div>
          <div class="map-label north">SOUTH DAKOTA</div><div class="map-label south">KANSAS</div>
          <div class="map-label west">WYOMING</div><div class="map-label east">IOWA</div>
          <div class="radar-legend"><span>LIGHT</span><i></i><i></i><i></i><i></i><span>HEAVY</span></div>
        </div>
        <div class="radar-footer"><span id="frame-time">Awaiting radar imagery</span><span>NOAA NEXRAD mosaic via Iowa Environmental Mesonet</span></div>
      </section>
      <aside class="forecast panel" aria-label="Forecast">
        <div class="panel-label">OUTLOOK</div>
        <div id="forecast-period" class="forecast-period">Loading forecast…</div>
        <div id="forecast-temp" class="forecast-temp">--</div>
        <p id="forecast-detail">National Weather Service forecast data is loading.</p>
        <div class="forecast-footer"><span>NWS ${office.nwrOffice}</span><span id="forecast-updated"></span></div>
      </aside>
    </section>
    <footer class="footer"><span id="system-status">DATA: CONNECTING</span><span>WEATHER AWARENESS DISPLAY — CHECK OFFICIAL ALERTS</span><span id="last-refresh">--</span></footer>
  </main>
`;

function celsiusToFahrenheit(value) {
  return value === null || value === undefined ? null : Math.round((value * 9) / 5 + 32);
}

function formatWind(speed, direction) {
  if (speed === null || speed === undefined) return "Calm / --";
  const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round((direction || 0) / 45) % 8];
  return `${Math.round(speed * 2.237)} mph ${compass}`;
}

function stamp() {
  return new Intl.DateTimeFormat("en-US", { timeZone: office.timezone, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).format(new Date());
}

function updateClock() {
  $("#clock").textContent = `${stamp()} CT`;
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

async function loadWeather() {
  try {
    const [observation, forecast] = await Promise.all([
      fetchJson(`${NWS_HOST}/stations/${office.nearbyObservationStation}/observations/latest`),
      fetchJson(`${NWS_HOST}/gridpoints/OAX/42,60/forecast`)
    ]);
    const props = observation.properties;
    const fahrenheit = celsiusToFahrenheit(props.temperature?.value);
    $("#temperature").innerHTML = fahrenheit === null ? "--<span>°</span>" : `${fahrenheit}<span>°</span>`;
    $("#condition").textContent = props.textDescription || "Conditions unavailable";
    $("#wind").textContent = formatWind(props.windSpeed?.value, props.windDirection?.value);
    $("#humidity").textContent = props.relativeHumidity?.value === null ? "--" : `${Math.round(props.relativeHumidity.value)}%`;
    $("#observation-note").textContent = `${office.locationNote} Observed ${new Date(props.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: office.timezone })} CT.`;

    const period = forecast.properties.periods?.[0];
    if (period) {
      $("#forecast-period").textContent = period.name.toUpperCase();
      $("#forecast-temp").textContent = `${period.temperature}°`;
      $("#forecast-detail").textContent = period.detailedForecast;
      $("#forecast-updated").textContent = "NOAA / NWS";
    }
    $("#system-status").textContent = "DATA: LIVE NOAA / NWS";
    $("#last-refresh").textContent = `UPDATED ${stamp()} CT`;
  } catch (error) {
    $("#condition").textContent = "NOAA conditions unavailable";
    $("#forecast-period").textContent = "FORECAST UNAVAILABLE";
    $("#forecast-detail").textContent = "The National Weather Service request did not complete. This display will retry automatically.";
    $("#system-status").textContent = "DATA: NWS RETRYING";
    console.warn("NWS weather request failed:", error);
  }
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
  const bounds = { west: -126, east: -66, south: 24, north: 50 };
  const viewport = office.radarViewport;
  const width = ((bounds.east - bounds.west) / (viewport.east - viewport.west)) * 100;
  const height = ((bounds.north - bounds.south) / (viewport.north - viewport.south)) * 100;
  const left = -((viewport.west - bounds.west) / (bounds.east - bounds.west)) * width;
  const top = -((bounds.north - viewport.north) / (bounds.north - bounds.south)) * height;
  Object.assign($("#radar-image").style, { width: `${width}%`, height: `${height}%`, left: `${left}%`, top: `${top}%` });
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
fitSlideToViewport();
window.addEventListener("resize", fitSlideToViewport, { passive: true });
updateClock();
setInterval(updateClock, 1000);
loadWeather();
loadRadar();
setInterval(loadWeather, DATA_REFRESH_MS);
setInterval(loadRadar, RADAR_REFRESH_MS);
