import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ==================================================
// FIX LEAFLET MARKER ICONS
// ==================================================

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ==================================================
// API
// ==================================================

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

// ==================================================
// DEFAULT MAP CENTER
// ==================================================

const DEFAULT_CENTER = [28.6139, 77.2090];

// ==================================================
// ACTIVE CASE STATUSES
// ==================================================

const ACTIVE_CASE_STATUSES = ["NEW", "ASSIGNED"];

// ==================================================
// PRIORITY COLORS
// ==================================================

const priorityColor = (priority) => {
  switch (String(priority || "").toUpperCase()) {
    case "CRITICAL":
      return "#dc2626";

    case "HIGH":
      return "#ea580c";

    case "MODERATE":
      return "#eab308";

    case "LOW":
      return "#16a34a";

    default:
      return "#64748b";
  }
};

// ==================================================
// RESPONDER COLORS
// ==================================================

const responderColor = (availability) => {
  switch (String(availability || "").toUpperCase()) {
    case "AVAILABLE":
      return "#2563eb";

    case "BUSY":
      return "#9333ea";

    default:
      return "#64748b";
  }
};

// ==================================================
// LOCATION HELPER
// Supports latitude/longitude
// and lat/lng if backend changes later
// ==================================================

const getCoordinates = (item) => {
  if (!item?.location) {
    return null;
  }

  const lat = Number(
    item.location.latitude ??
      item.location.lat
  );

  const lng = Number(
    item.location.longitude ??
      item.location.lng ??
      item.location.lon
  );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  return {
    lat,
    lng,
  };
};

// ==================================================
// HAVERSINE DISTANCE
// Returns distance in KM
// ==================================================

const distanceInKm = (
  lat1,
  lon1,
  lat2,
  lon2
) => {
  const earthRadius = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
};

// ==================================================
// CUSTOM CASE ICON
// ==================================================

const createCaseIcon = (priority) => {
  const color = priorityColor(priority);

  return L.divIcon({
    className: "pawsignal-case-marker",

    html: `
      <div
        style="
          width: 20px;
          height: 20px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        "
      ></div>
    `,

    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
};

// ==================================================
// CUSTOM RESPONDER ICON
// ==================================================

const createResponderIcon = (
  availability
) => {
  const color =
    responderColor(availability);

  return L.divIcon({
    className:
      "pawsignal-responder-marker",

    html: `
      <div
        style="
          width: 18px;
          height: 18px;
          background: ${color};
          border: 3px solid white;
          border-radius: 4px;
          transform: rotate(45deg);
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        "
      ></div>
    `,

    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
};

// ==================================================
// MAP RESIZE
// ==================================================

function MapResize() {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

// ==================================================
// MAP VIEW CONTROLLER
//
// Automatically moves map to active cases.
// If there is one active case -> center on it.
// If there are multiple active cases -> fit them.
// ==================================================

function MapViewController({
  activeCases,
  nearbyResponders,
}) {
  const map = useMap();

  useEffect(() => {
    if (!activeCases.length) {
      map.setView(DEFAULT_CENTER, 13);
      return;
    }

    const points = [];

    activeCases.forEach((item) => {
      const coords = getCoordinates(item);

      if (coords) {
        points.push([
          coords.lat,
          coords.lng,
        ]);
      }
    });

    nearbyResponders.forEach((item) => {
      const coords = getCoordinates(item);

      if (coords) {
        points.push([
          coords.lat,
          coords.lng,
        ]);
      }
    });

    if (!points.length) {
      map.setView(DEFAULT_CENTER, 13);
      return;
    }

    // One active case:
    // focus directly on that animal
    if (activeCases.length === 1) {
      const coords =
        getCoordinates(activeCases[0]);

      if (coords) {
        map.flyTo(
          [coords.lat, coords.lng],
          14,
          {
            duration: 1,
          }
        );
      }

      return;
    }

    // Multiple active cases:
    // show all active cases + nearby responders
    const bounds = L.latLngBounds(points);

    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 14,
      animate: true,
    });
  }, [
    activeCases,
    nearbyResponders,
    map,
  ]);

  return null;
}

// ==================================================
// MAP PAGE
// ==================================================

function MapPage() {
  const [cases, setCases] = useState([]);
  const [responders, setResponders] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showCases, setShowCases] =
    useState(true);

  const [showResponders, setShowResponders] =
    useState(true);

  // ==================================================
  // LOAD DATA
  // ==================================================

  const loadMapData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        casesResponse,
        respondersResponse,
      ] = await Promise.all([
        fetch(`${API_BASE}/cases`),
        fetch(`${API_BASE}/responders`),
      ]);

      if (!casesResponse.ok) {
        throw new Error(
          "Failed to load cases."
        );
      }

      if (!respondersResponse.ok) {
        throw new Error(
          "Failed to load responders."
        );
      }

      const casesData =
        await casesResponse.json();

      const respondersData =
        await respondersResponse.json();

      setCases(
        Array.isArray(casesData.cases)
          ? casesData.cases
          : []
      );

      setResponders(
        Array.isArray(
          respondersData.responders
        )
          ? respondersData.responders
          : []
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load map data. Please make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();
  }, []);

  // ==================================================
  // IMPORTANT:
  // ONLY ACTIVE CASES ARE ALLOWED ON MAP
  //
  // NEW      -> SHOW
  // ASSIGNED -> SHOW
  // RESOLVED -> HIDE
  // CLOSED   -> HIDE
  // ==================================================

  const activeCases = useMemo(() => {
    return cases.filter((item) => {
      const status = String(
        item.status || ""
      ).toUpperCase();

      return (
        ACTIVE_CASE_STATUSES.includes(
          status
        ) &&
        getCoordinates(item)
      );
    });
  }, [cases]);

  // ==================================================
  // FIND NEARBY RESPONDERS
  //
  // A responder is shown ONLY when:
  //
  // 1. There is an active case
  // 2. Responder has valid coordinates
  // 3. Responder is not OFFLINE
  // 4. Responder is within service radius
  //
  // This removes old/far-away responders.
  // ==================================================

  const nearbyResponders = useMemo(() => {
    if (!activeCases.length) {
      return [];
    }

    const matchingResponders = [];

    responders.forEach((responder) => {
      const availability =
        String(
          responder.availability || ""
        ).toUpperCase();

      // NEVER show offline responders
      if (availability === "OFFLINE") {
        return;
      }

      const responderCoords =
        getCoordinates(responder);

      if (!responderCoords) {
        return;
      }

      const serviceRadius =
        Number(
          responder.service_radius_km
        ) || 10;

      let closestDistance = Infinity;
      let matchedCase = null;

      activeCases.forEach((animalCase) => {
        const caseCoords =
          getCoordinates(animalCase);

        if (!caseCoords) {
          return;
        }

        const distance =
          distanceInKm(
            caseCoords.lat,
            caseCoords.lng,
            responderCoords.lat,
            responderCoords.lng
          );

        if (
          distance <
          closestDistance
        ) {
          closestDistance = distance;
          matchedCase = animalCase;
        }
      });

      // Only show responder if inside
      // its actual service radius
      if (
        matchedCase &&
        closestDistance <=
          serviceRadius
      ) {
        matchingResponders.push({
          ...responder,
          distance_km:
            closestDistance,
          matched_case_id:
            matchedCase.case_id,
        });
      }
    });

    // Closest responder first
    return matchingResponders.sort(
      (a, b) =>
        a.distance_km -
        b.distance_km
    );
  }, [
    responders,
    activeCases,
  ]);

  // ==================================================
  // STATISTICS
  //
  // These statistics now represent
  // WHAT IS ACTUALLY SHOWN ON THE MAP.
  // ==================================================

  const criticalCount =
    activeCases.filter(
      (item) =>
        String(
          item.priority || ""
        ).toUpperCase() ===
        "CRITICAL"
    ).length;

  const highCount =
    activeCases.filter(
      (item) =>
        String(
          item.priority || ""
        ).toUpperCase() ===
        "HIGH"
    ).length;

  const availableNearbyResponders =
    nearbyResponders.filter(
      (item) =>
        String(
          item.availability || ""
        ).toUpperCase() ===
        "AVAILABLE"
    ).length;

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div className="app">
      <Navbar />

      <main className="page-container">

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="page-heading">

          <span className="eyebrow">
            GEOSPATIAL INTELLIGENCE
          </span>

          <h1>Welfare Map</h1>

          <p>
            Visualize active animal distress
            cases and nearby rescue responders.
          </p>

        </div>

        {/* ==================================================
            MAP STATS
        ================================================== */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
            marginBottom: "18px",
          }}
        >

          <div className="placeholder-card">
            <strong>
              {activeCases.length}
            </strong>

            <span>
              Active Cases
            </span>
          </div>

          <div className="placeholder-card">
            <strong>
              {criticalCount}
            </strong>

            <span>
              Critical
            </span>
          </div>

          <div className="placeholder-card">
            <strong>
              {highCount}
            </strong>

            <span>
              High Priority
            </span>
          </div>

          <div className="placeholder-card">
            <strong>
              {activeCases.length}
            </strong>

            <span>
              Cases on Map
            </span>
          </div>

          <div className="placeholder-card">
            <strong>
              {availableNearbyResponders}
            </strong>

            <span>
              Nearby Responders
            </span>
          </div>

        </div>

        {/* ==================================================
    CONTROLS
================================================== */}

<div className="map-controls">

  <button
    onClick={() =>
      setShowCases(!showCases)
    }
  >
    {showCases
      ? "Hide Cases"
      : "Show Cases"}
  </button>

  <button
    onClick={() =>
      setShowResponders(
        !showResponders
      )
    }
  >
    {showResponders
      ? "Hide Responders"
      : "Show Responders"}
  </button>

  <button onClick={loadMapData}>
    ↻ Refresh Map
  </button>

</div>

        {/* ==================================================
            LEGEND
        ================================================== */}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "15px",
            fontSize: "14px",
          }}
        >

          <span>
            <span
              style={{ color: "#dc2626" }}
            >
              ●
            </span>{" "}
            Critical
          </span>

          <span>
            <span
              style={{ color: "#ea580c" }}
            >
              ●
            </span>{" "}
            High
          </span>

          <span>
            <span
              style={{ color: "#eab308" }}
            >
              ●
            </span>{" "}
            Moderate
          </span>

          <span>
            <span
              style={{ color: "#16a34a" }}
            >
              ●
            </span>{" "}
            Low
          </span>

          <span>
            <span
              style={{ color: "#2563eb" }}
            >
              ◆
            </span>{" "}
            Available Responder
          </span>

          <span>
            <span
              style={{ color: "#9333ea" }}
            >
              ◆
            </span>{" "}
            Busy Responder
          </span>

        </div>

        {/* ==================================================
            ERROR
        ================================================== */}

        {error && (
          <div
            style={{
              padding: "15px",
              marginBottom: "15px",
              borderRadius: "10px",
              background: "#fee2e2",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        )}

        {/* ==================================================
            NO ACTIVE CASE MESSAGE
        ================================================== */}

        {!loading &&
          activeCases.length === 0 && (
            <div
              style={{
                padding: "18px",
                marginBottom: "15px",
                borderRadius: "12px",
                background: "#ecfdf5",
                color: "#166534",
                border:
                  "1px solid #bbf7d0",
              }}
            >
              <strong>
                No active animal cases.
              </strong>

              <div
                style={{
                  marginTop: "5px",
                  fontSize: "14px",
                }}
              >
                Resolved and closed cases are
                intentionally hidden from the
                welfare map.
              </div>
            </div>
          )}

        {/* ==================================================
            ACTIVE CASE / RESPONDER INFO
        ================================================== */}

        {!loading &&
          activeCases.length > 0 && (
            <div
              style={{
                padding: "12px 15px",
                marginBottom: "15px",
                borderRadius: "10px",
                background: "#f0fdf4",
                color: "#166534",
                border:
                  "1px solid #dcfce7",
                fontSize: "14px",
              }}
            >
              Showing{" "}
              <strong>
                {activeCases.length}
              </strong>{" "}
              active case
              {activeCases.length !== 1
                ? "s"
                : ""}{" "}
              and{" "}
              <strong>
                {nearbyResponders.length}
              </strong>{" "}
              nearby responder
              {nearbyResponders.length !==
              1
                ? "s"
                : ""}.
            </div>
          )}

        {/* ==================================================
            MAP
        ================================================== */}

        <div
          style={{
            height: "620px",
            width: "100%",
            borderRadius: "16px",
            overflow: "hidden",
            border:
              "1px solid #e5e7eb",
            position: "relative",
          }}
        >

          {/* LOADING */}
          {loading && (
            <div
              style={{
                position: "absolute",
                zIndex: 1000,
                top: "15px",
                left: "50%",
                transform:
                  "translateX(-50%)",
                background: "white",
                padding:
                  "10px 18px",
                borderRadius: "10px",
                boxShadow:
                  "0 4px 15px rgba(0,0,0,0.15)",
              }}
            >
              Loading welfare map...
            </div>
          )}

          <MapContainer
            center={DEFAULT_CENTER}
            zoom={13}
            scrollWheelZoom={true}
            style={{
              height: "100%",
              width: "100%",
            }}
          >

            <MapResize />

            <MapViewController
              activeCases={activeCases}
              nearbyResponders={
                nearbyResponders
              }
            />

            {/* ==================================================
                OPEN STREET MAP
            ================================================== */}

            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* ==================================================
                ACTIVE CASE MARKERS ONLY
            ================================================== */}

            {showCases &&
              activeCases.map((item) => {
                const coords =
                  getCoordinates(item);

                if (!coords) {
                  return null;
                }

                return (
                  <Marker
                    key={`case-${item.case_id}`}
                    position={[
                      coords.lat,
                      coords.lng,
                    ]}
                    icon={createCaseIcon(
                      item.priority
                    )}
                  >

                    <Popup>

                      <div
                        style={{
                          minWidth:
                            "230px",
                        }}
                      >

                        <h3>
                          🐾{" "}
                          {item.case_id ||
                            "Animal Case"}
                        </h3>

                        <p>
                          <strong>
                            Species:
                          </strong>{" "}
                          {item.species ||
                            "Unknown"}
                        </p>

                        <p>
                          <strong>
                            PAWScore:
                          </strong>{" "}
                          {item.score ??
                            "—"}
                        </p>

                        <p>
                          <strong>
                            Priority:
                          </strong>{" "}
                          <span
                            style={{
                              color:
                                priorityColor(
                                  item.priority
                                ),
                              fontWeight:
                                "700",
                            }}
                          >
                            {item.priority}
                          </span>
                        </p>

                        <p>
                          <strong>
                            Status:
                          </strong>{" "}
                          {item.status}
                        </p>

                        <p>
                          <strong>
                            Location:
                          </strong>{" "}
                          {coords.lat.toFixed(
                            5
                          )}
                          ,{" "}
                          {coords.lng.toFixed(
                            5
                          )}
                        </p>

                        <p>
                          <strong>
                            Confidence:
                          </strong>{" "}
                          {item.confidence !=
                          null
                            ? `${Math.round(
                                item.confidence *
                                  100
                              )}%`
                            : "—"}
                        </p>

                        {item.assigned_responder && (
                          <p>
                            <strong>
                              Responder:
                            </strong>{" "}
                            {
                              item
                                .assigned_responder
                                .name
                            }
                          </p>
                        )}

                        {item.recommendation && (
                          <p>
                            <strong>
                              Recommendation:
                            </strong>{" "}
                            {
                              item.recommendation
                            }
                          </p>
                        )}

                      </div>

                    </Popup>

                  </Marker>
                );
              })}

            {/* ==================================================
                NEARBY RESPONDER MARKERS ONLY
            ================================================== */}

            {showResponders &&
              nearbyResponders.map(
                (responder) => {
                  const coords =
                    getCoordinates(
                      responder
                    );

                  if (!coords) {
                    return null;
                  }

                  const serviceRadius =
                    Number(
                      responder.service_radius_km
                    ) || 10;

                  return (
                    <div
                      key={`responder-${responder.responder_id}`}
                    >

                      {/* RESPONDER MARKER */}

                      <Marker
                        position={[
                          coords.lat,
                          coords.lng,
                        ]}
                        icon={createResponderIcon(
                          responder.availability
                        )}
                      >

                        <Popup>

                          <div
                            style={{
                              minWidth:
                                "240px",
                            }}
                          >

                            <h3>
                              🚑{" "}
                              {responder.name}
                            </h3>

                            <p>
                              <strong>
                                Type:
                              </strong>{" "}
                              {
                                responder.responder_type
                              }
                            </p>

                            <p>
                              <strong>
                                Specialization:
                              </strong>{" "}
                              {
                                responder.specialization ||
                                "General"
                              }
                            </p>

                            <p>
                              <strong>
                                Availability:
                              </strong>{" "}
                              <span
                                style={{
                                  color:
                                    responderColor(
                                      responder.availability
                                    ),
                                  fontWeight:
                                    "700",
                                }}
                              >
                                {
                                  responder.availability
                                }
                              </span>
                            </p>

                            <p>
                              <strong>
                                Distance:
                              </strong>{" "}
                              {responder.distance_km.toFixed(
                                2
                              )}{" "}
                              km
                            </p>

                            <p>
                              <strong>
                                Service Radius:
                              </strong>{" "}
                              {
                                serviceRadius
                              }{" "}
                              km
                            </p>

                            <p>
                              <strong>
                                Active Cases:
                              </strong>{" "}
                              {
                                responder.active_cases ??
                                0
                              }
                            </p>

                            <p>
                              <strong>
                                Total Cases:
                              </strong>{" "}
                              {
                                responder.total_cases ??
                                0
                              }
                            </p>

                            <p>
                              <strong>
                                Verified:
                              </strong>{" "}
                              {responder.verified
                                ? "Yes"
                                : "No"}
                            </p>

                            <p>
                              <strong>
                                Matched Case:
                              </strong>{" "}
                              {
                                responder.matched_case_id
                              }
                            </p>

                            <p>
                              <strong>
                                Location:
                              </strong>{" "}
                              {coords.lat.toFixed(
                                5
                              )}
                              ,{" "}
                              {coords.lng.toFixed(
                                5
                              )}
                            </p>

                          </div>

                        </Popup>

                      </Marker>

                      {/* ==================================================
                          SERVICE RADIUS
                      ================================================== */}

                      <Circle
                        center={[
                          coords.lat,
                          coords.lng,
                        ]}
                        radius={
                          serviceRadius *
                          1000
                        }
                        pathOptions={{
                          fillOpacity: 0.04,
                          weight: 1,
                        }}
                      />

                    </div>
                  );
                }
              )}

          </MapContainer>

        </div>

      </main>
    </div>
  );
}

export default MapPage;