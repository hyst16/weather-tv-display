import offices from "./offices.json";

export { offices };

export function getOffice() {
  const segment = location.pathname.split("/").filter(Boolean).pop();
  return offices[segment];
}
