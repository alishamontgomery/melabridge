const POSTAL_CODE_PATTERN = /^\d{5}(?:-\d{4})?$/;

const KNOWN_POSTAL_LOCATIONS: Record<string, { label: string; latitude: number; longitude: number }> = {
  "35756": { label: "Madison, AL", latitude: 34.7739, longitude: -86.7483 },
};

export function distanceMilesBetween(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusMiles = 3_958.7613;
  const latitudeDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const fromLatitude = (from.latitude * Math.PI) / 180;
  const toLatitude = (to.latitude * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function isPostalCode(value: string | null | undefined) {
  return POSTAL_CODE_PATTERN.test(value?.trim() ?? "");
}

export function getKnownPostalLocation(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!isPostalCode(normalized)) return null;
  return KNOWN_POSTAL_LOCATIONS[normalized] ?? null;
}