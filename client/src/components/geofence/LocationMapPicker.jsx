import React, { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Satellite, Search, Map as MapIcon } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAddress } from "../../utils/geocoding";

// ============================================================================
// Geofenced login (2026-08-07) — visual location picker.
//
// Leaflet + OpenStreetMap. No API key, no billing account, no Cloud console —
// which is why it replaced the Google Maps version: that one worked only after
// enabling two separate APIs against a project with a card on file, and failed
// with a grey rectangle when either step was missed.
//
// The radius circle is the point of this component. An admin typing `200` into
// a number field has no way to know whether that covers their office or half
// the neighbourhood — and picking it wrong is not cosmetic: too tight and staff
// are locked out at their desks, too loose and the fence stops meaning
// anything. Seeing the circle over the roofline turns that from a guess into a
// decision.
//
// ─── DEGRADES, NEVER BLOCKS ───
// The manual latitude/longitude fields beneath this remain the source of truth
// throughout. The map is an input device for those fields, not a replacement.
// If tiles fail to load the admin can still type coordinates, and "use my
// current position" never touches the network at all — it is the browser's own
// GPS.
// ============================================================================

const DEFAULT_CENTER = [22.5726, 88.3639]; // Kolkata
const DEFAULT_ZOOM = 16;

// Attribution is a LICENSING REQUIREMENT, not decoration. OSM data is ODbL and
// the tile usage policy requires visible credit; Esri's imagery service
// likewise. Leaflet renders these in the corner automatically — do not remove.
const TILE_LAYERS = {
  street: {
    label: "Street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
};

// A pin drawn as inline SVG rather than Leaflet's default marker image.
//
// Leaflet's default icon resolves its PNGs relative to the CSS file, which
// breaks under every bundler — the classic "marker is a broken image" bug. The
// usual fix is importing three PNGs and patching L.Icon.Default; an inline SVG
// avoids the asset pipeline entirely and can carry the app's own blue.
const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26c0-7.73-6.27-14-14-14z" fill="#2563eb"/>
    <circle cx="14" cy="14" r="5.5" fill="#fff"/>
  </svg>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40], // tip of the pin sits on the point
});

export default function LocationMapPicker({
  latitude,
  longitude,
  radiusMeters,
  onChange,
  onError,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const tileRef = useRef(null);

  // Guards the prop→map sync against the map's own events. Without it, dragging
  // the pin fires onChange, the parent re-renders with new props, the sync
  // effect moves the pin, which fires another event — a loop that manifests as
  // the pin juddering and fighting the cursor.
  const applyingPropsRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [layer, setLayer] = useState("street");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  // Held in a ref so the init effect never re-runs when the parent passes a
  // fresh inline callback — re-running would rebuild the map and discard the
  // admin's pan/zoom on every keystroke elsewhere in the form.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const numericLat = Number(latitude);
  const numericLng = Number(longitude);
  const hasPosition =
    latitude !== "" && longitude !== "" &&
    Number.isFinite(numericLat) && Number.isFinite(numericLng);

  const emit = useCallback((next) => onChangeRef.current?.(next), []);

  // ── Build the map once ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const center = hasPosition ? [numericLat, numericLng] : DEFAULT_CENTER;

    const map = L.map(containerRef.current, {
      center,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
    });

    const def = TILE_LAYERS.street;
    tileRef.current = L.tileLayer(def.url, {
      attribution: def.attribution,
      maxZoom: def.maxZoom,
    }).addTo(map);

    circleRef.current = L.circle(center, {
      radius: Number(radiusMeters) || 200,
      color: "#2563eb",
      weight: 2,
      opacity: 0.9,
      fillColor: "#3b82f6",
      fillOpacity: 0.15,
      // The circle sits under the pin and must not swallow map clicks — the
      // admin's instinct is to click inside the circle to nudge the centre,
      // and an interactive circle would eat that click.
      interactive: false,
    }).addTo(map);

    markerRef.current = L.marker(center, { icon: pinIcon, draggable: true }).addTo(map);

    map.on("click", (e) => {
      if (applyingPropsRef.current) return;
      emit({
        latitude: e.latlng.lat.toFixed(6),
        longitude: e.latlng.lng.toFixed(6),
      });
    });

    markerRef.current.on("dragend", (e) => {
      if (applyingPropsRef.current) return;
      const { lat, lng } = e.target.getLatLng();
      emit({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) });
    });

    mapRef.current = map;
    setReady(true);

    // Leaflet measures the container on creation. This one is inside a panel
    // that is toggled open, so on the first paint it can measure zero height
    // and render a sliver of map or a grey box. Re-measuring on the next frame
    // fixes it, and is cheap enough not to be worth conditionalising.
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      tileRef.current = null;
    };
    // Built once; thereafter driven by the sync effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Swap tile layer ────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || !tileRef.current) return;
    const next = TILE_LAYERS[layer];
    tileRef.current.setUrl(next.url);
    // Attribution is per-layer and must follow the tiles, or the map credits a
    // source it is no longer showing.
    mapRef.current.attributionControl.removeAttribution(TILE_LAYERS.street.attribution);
    mapRef.current.attributionControl.removeAttribution(TILE_LAYERS.satellite.attribution);
    mapRef.current.attributionControl.addAttribution(next.attribution);
  }, [layer, ready]);

  // ── Push prop changes into the map ─────────────────────────────────────
  // Covers "use my current position", address search, and manual typing —
  // all of which must move the pin.
  useEffect(() => {
    if (!ready || !hasPosition) return;

    applyingPropsRef.current = true;
    try {
      const point = [numericLat, numericLng];
      markerRef.current?.setLatLng(point);
      circleRef.current?.setLatLng(point);
      mapRef.current?.panTo(point);
    } finally {
      // Cleared on a macrotask: Leaflet fires move events asynchronously, so
      // clearing synchronously would let them through and reopen the loop this
      // guard exists to close.
      setTimeout(() => {
        applyingPropsRef.current = false;
      }, 0);
    }
  }, [ready, numericLat, numericLng, hasPosition]);

  useEffect(() => {
    if (!ready || !circleRef.current) return;
    const next = Number(radiusMeters);
    if (!Number.isFinite(next) || next <= 0) return;
    circleRef.current.setRadius(next);
  }, [ready, radiusMeters]);

  // ── Address search ─────────────────────────────────────────────────────
  const runSearch = async (e) => {
    e?.preventDefault();
    if (!search.trim() || searching) return;

    setSearching(true);
    try {
      const hit = await geocodeAddress(search);
      emit({
        latitude: hit.latitude.toFixed(6),
        longitude: hit.longitude.toFixed(6),
        address: hit.formattedAddress,
      });
      mapRef.current?.setView([hit.latitude, hit.longitude], DEFAULT_ZOOM);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Not a <form>: this renders INSIDE the location form, and nested forms
          are invalid HTML — the browser drops the inner one, so Enter would
          submit the outer form and save a half-filled location. */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch(e);
              }
            }}
            placeholder="Search an address, then click the map to fine-tune..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
          />
        </div>

        <button
          type="button"
          onClick={runSearch}
          disabled={searching || !search.trim()}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
        >
          {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Find
        </button>

        <button
          type="button"
          onClick={() => setLayer((l) => (l === "street" ? "satellite" : "street"))}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
        >
          {layer === "street" ? <Satellite size={14} /> : <MapIcon size={14} />}
          {layer === "street" ? "Satellite" : "Street"}
        </button>
      </div>

      <div
        ref={containerRef}
        // z-0 matters: Leaflet's panes carry z-index values in the hundreds and
        // will otherwise paint over the modal/overlay stack this form lives in.
        className="z-0 h-[320px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.03]"
      />

      <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
        Click the map to move the fence centre, or drag the pin. The blue circle
        is exactly the area your staff will be able to sign in from — adjust it
        with the radius field below. Switch to Satellite to line it up with your
        building.
      </p>
    </div>
  );
}
