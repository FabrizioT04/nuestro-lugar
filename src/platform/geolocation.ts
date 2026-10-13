import { Geolocation } from "@capacitor/geolocation";
import { isNativeApp } from "./native";

// Ubicación actual. En la web usa el navegador; en la app, el GPS de Android (que pide el permiso
// con el diálogo del sistema). Las pantallas no saben cuál de los dos se usa.

export interface Coordinates {
  lat: number;
  lng: number;
}

export type LocationErrorReason = "unsupported" | "denied" | "unavailable";

export class LocationError extends Error {
  constructor(readonly reason: LocationErrorReason) {
    super(reason);
    this.name = "LocationError";
  }
}

const OPTIONS = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60 * 1000 };

async function nativePosition(): Promise<Coordinates> {
  try {
    let permission = await Geolocation.checkPermissions();
    if (permission.location !== "granted" && permission.coarseLocation !== "granted") {
      permission = await Geolocation.requestPermissions({ permissions: ["coarseLocation"] });
    }
    if (permission.location === "denied" && permission.coarseLocation === "denied") throw new LocationError("denied");
    const position = await Geolocation.getCurrentPosition(OPTIONS);
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (err) {
    if (err instanceof LocationError) throw err;
    // El GPS apagado o un permiso negado en el diálogo llegan como error del plugin.
    throw new LocationError(/denied|permission/i.test(String((err as Error)?.message)) ? "denied" : "unavailable");
  }
}

function webPosition(): Promise<Coordinates> {
  if (!("geolocation" in navigator)) return Promise.reject(new LocationError("unsupported"));
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (err) => reject(new LocationError(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable")),
      OPTIONS,
    ),
  );
}

/** Ubicación aproximada actual. Lanza LocationError si no hay permiso o no se pudo obtener. */
export function getCurrentPosition(): Promise<Coordinates> {
  return isNativeApp ? nativePosition() : webPosition();
}
