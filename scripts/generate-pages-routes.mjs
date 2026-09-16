import { cp, mkdir, readFile } from "node:fs/promises";

const offices = JSON.parse(await readFile(new URL("../src/offices.json", import.meta.url)));
for (const office of Object.values(offices)) {
  await mkdir(`dist/${office.slug}`, { recursive: true });
  await cp("dist/index.html", `dist/${office.slug}/index.html`);
}
