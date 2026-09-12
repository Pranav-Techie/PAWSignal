import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";

const API_BASE =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function Analytics() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadCases = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_BASE}/cases`);

        if (!response.ok) {
          throw new Error("Failed to load cases.");
        }

        const data = await response.json();

        setCases(Array.isArray(data.cases) ? data.cases : []);
      } catch (err) {
        console.error(err);
        setError(
          "Unable to load analytics. Please make sure the backend is running."
        );
      } finally {
        setLoading(false);
      }
    };

    loadCases();
  }, []);

  // ================================
  // BASIC CASE COUNTS
  // ================================

  const totalCases = cases.length;

  const resolvedCases = useMemo(
    () =>
      cases.filter((item) =>
        ["RESOLVED", "CLOSED"].includes(
          String(item.status || "").toUpperCase()
        )
      ).length,
    [cases]
  );

  const activeCases = useMemo(
    () =>
      cases.filter((item) =>
        ["NEW", "ASSIGNED"].includes(
          String(item.status || "").toUpperCase()
        )
      ).length,
    [cases]
  );

  const criticalCases = useMemo(
    () =>
      cases.filter(
        (item) =>
          String(item.priority || "").toUpperCase() === "CRITICAL"
      ).length,
    [cases]
  );

  const rescueRate =
    totalCases > 0
      ? Math.round((resolvedCases / totalCases) * 100)
      : 0;

  // ================================
  // PRIORITY DISTRIBUTION
  // ================================

  const priorityCounts = useMemo(() => {
    const counts = {
      CRITICAL: 0,
      HIGH: 0,
      MODERATE: 0,
      LOW: 0,
    };

    cases.forEach((item) => {
      const priority = String(item.priority || "").toUpperCase();

      if (counts[priority] !== undefined) {
        counts[priority]++;
      }
    });

    return counts;
  }, [cases]);

  const maxPriority = Math.max(
    ...Object.values(priorityCounts),
    1
  );

  // ================================
  // STATUS DISTRIBUTION
  // ================================

  const statusCounts = useMemo(() => {
    const counts = {};

    cases.forEach((item) => {
      const status = String(
        item.status || "UNKNOWN"
      ).toUpperCase();

      counts[status] = (counts[status] || 0) + 1;
    });

    return counts;
  }, [cases]);

  const maxStatus = Math.max(
    ...Object.values(statusCounts),
    1
  );

  // ================================
  // SPECIES DISTRIBUTION
  // ================================

  const speciesCounts = useMemo(() => {
    const counts = {};

    cases.forEach((item) => {
      const species = item.species || "Unknown";

      counts[species] = (counts[species] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [cases]);

  const maxSpecies = Math.max(
    ...speciesCounts.map((item) => item[1]),
    1
  );

  // ================================
  // AVERAGE PAWSCORE
  // ================================

  const averageScore = useMemo(() => {
    const scores = cases
      .map((item) => Number(item.score))
      .filter((score) => Number.isFinite(score));

    if (!scores.length) return "—";

    const total = scores.reduce(
      (sum, score) => sum + score,
      0
    );

    return Math.round(total / scores.length);
  }, [cases]);

  // ================================
  // STYLES
  // ================================

  const pageStyle = {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "42px 24px 70px",
  };

  const headingStyle = {
    marginBottom: "30px",
  };

  const eyebrowStyle = {
    display: "block",
    marginBottom: "8px",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    color: "#176b4d",
  };

  const titleStyle = {
    margin: "0 0 10px",
    fontSize: "42px",
    lineHeight: "1.1",
    color: "#17251f",
  };

  const subtitleStyle = {
    maxWidth: "720px",
    margin: 0,
    color: "#68756f",
    fontSize: "16px",
    lineHeight: "1.6",
  };

  const kpiGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "24px",
  };

  const kpiStyle = {
    minHeight: "125px",
    padding: "20px 12px",
    background: "#ffffff",
    border: "1px solid #dce5df",
    borderRadius: "14px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    boxSizing: "border-box",
  };

  const kpiValueStyle = {
    display: "block",
    fontSize: "27px",
    fontWeight: "800",
    color: "#17251f",
    marginBottom: "7px",
  };

  const kpiLabelStyle = {
    fontSize: "13px",
    lineHeight: "1.35",
    color: "#68756f",
  };

  const analyticsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "18px",
  };

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #dce5df",
    borderRadius: "16px",
    padding: "25px",
    minHeight: "300px",
    boxSizing: "border-box",
  };

  const cardTitleStyle = {
    margin: "0 0 7px",
    fontSize: "21px",
    color: "#17251f",
  };

  const cardDescriptionStyle = {
    margin: "0 0 24px",
    color: "#78837e",
    fontSize: "14px",
    lineHeight: "1.5",
  };

  const rowStyle = {
    marginBottom: "18px",
  };

  const rowHeaderStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "7px",
    fontSize: "14px",
    color: "#34413b",
  };

  const barBackgroundStyle = {
    height: "9px",
    background: "#e9eeeb",
    borderRadius: "20px",
    overflow: "hidden",
  };

  const insightsStyle = {
    gridColumn: "1 / -1",
    minHeight: "auto",
  };

  const insightGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  };

  const insightBoxStyle = {
    padding: "18px",
    borderRadius: "12px",
    textAlign: "center",
    background: "#f0fdf4",
  };

  // ================================
  // RENDER
  // ================================

  return (
    <div className="app">
      <Navbar />

      <main style={pageStyle}>

        {/* HEADER */}

        <div style={headingStyle}>
          <span style={eyebrowStyle}>
            WELFARE INTELLIGENCE
          </span>

          <h1 style={titleStyle}>
            Analytics
          </h1>

          <p style={subtitleStyle}>
            Understand where animal welfare emergencies are happening
            and how quickly they are being resolved.
          </p>
        </div>

        {/* ERROR */}

        {error && (
          <div
            style={{
              padding: "14px 16px",
              marginBottom: "18px",
              borderRadius: "10px",
              background: "#fee2e2",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        )}

        {/* ================================
            KPI CARDS
        ================================= */}

        <div style={kpiGridStyle}>

          <div style={kpiStyle}>
            <strong style={kpiValueStyle}>
              {loading ? "—" : totalCases}
            </strong>
            <span style={kpiLabelStyle}>
              Total Cases
            </span>
          </div>

          <div style={kpiStyle}>
            <strong style={kpiValueStyle}>
              {loading ? "—" : activeCases}
            </strong>
            <span style={kpiLabelStyle}>
              Active Cases
            </span>
          </div>

          <div style={kpiStyle}>
            <strong style={kpiValueStyle}>
              {loading ? "—" : resolvedCases}
            </strong>
            <span style={kpiLabelStyle}>
              Resolved Cases
            </span>
          </div>

          <div style={kpiStyle}>
            <strong style={kpiValueStyle}>
              {loading ? "—" : `${rescueRate}%`}
            </strong>
            <span style={kpiLabelStyle}>
              Resolution Rate
            </span>
          </div>

          <div style={kpiStyle}>
            <strong style={kpiValueStyle}>
              {loading ? "—" : criticalCases}
            </strong>
            <span style={kpiLabelStyle}>
              Critical Cases
            </span>
          </div>

          <div style={kpiStyle}>
            <strong style={kpiValueStyle}>
              {loading ? "—" : averageScore}
            </strong>
            <span style={kpiLabelStyle}>
              Average PAWScore
            </span>
          </div>

        </div>

        {/* ================================
            ANALYTICS CARDS
        ================================= */}

        <div style={analyticsGridStyle}>

          {/* PRIORITY */}

          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>
              Priority Distribution
            </h2>

            <p style={cardDescriptionStyle}>
              Severity of reported welfare cases.
            </p>

            {Object.entries(priorityCounts).map(
              ([priority, count]) => {

                const barColor =
                  priority === "CRITICAL"
                    ? "#dc2626"
                    : priority === "HIGH"
                    ? "#ea580c"
                    : priority === "MODERATE"
                    ? "#eab308"
                    : "#16a34a";

                return (
                  <div
                    key={priority}
                    style={rowStyle}
                  >
                    <div style={rowHeaderStyle}>
                      <span>{priority}</span>
                      <strong>{count}</strong>
                    </div>

                    <div style={barBackgroundStyle}>
                      <div
                        style={{
                          width: `${(count / maxPriority) * 100}%`,
                          height: "100%",
                          background: barColor,
                          borderRadius: "20px",
                        }}
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>

          {/* STATUS */}

          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>
              Case Status
            </h2>

            <p style={cardDescriptionStyle}>
              Current progress of welfare cases.
            </p>

            {Object.keys(statusCounts).length === 0 ? (
              <p>No case data available.</p>
            ) : (
              Object.entries(statusCounts).map(
                ([status, count]) => (
                  <div
                    key={status}
                    style={rowStyle}
                  >
                    <div style={rowHeaderStyle}>
                      <span>{status}</span>
                      <strong>{count}</strong>
                    </div>

                    <div style={barBackgroundStyle}>
                      <div
                        style={{
                          width: `${(count / maxStatus) * 100}%`,
                          height: "100%",
                          background: "#176b4d",
                          borderRadius: "20px",
                        }}
                      />
                    </div>
                  </div>
                )
              )
            )}
          </div>

          {/* SPECIES */}

          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>
              Species Distribution
            </h2>

            <p style={cardDescriptionStyle}>
              Animals involved in reported cases.
            </p>

            {speciesCounts.length === 0 ? (
              <p>No species data available.</p>
            ) : (
              speciesCounts.map(
                ([species, count]) => (
                  <div
                    key={species}
                    style={rowStyle}
                  >
                    <div style={rowHeaderStyle}>
                      <span>{species}</span>
                      <strong>{count}</strong>
                    </div>

                    <div style={barBackgroundStyle}>
                      <div
                        style={{
                          width: `${(count / maxSpecies) * 100}%`,
                          height: "100%",
                          background: "#176b4d",
                          borderRadius: "20px",
                        }}
                      />
                    </div>
                  </div>
                )
              )
            )}
          </div>

          {/* RESPONSE INSIGHTS */}

          <div
            style={{
              ...cardStyle,
              ...insightsStyle,
            }}
          >
            <h2 style={cardTitleStyle}>
              Response Insights
            </h2>

            <p style={cardDescriptionStyle}>
              Operational overview of the current welfare workload.
            </p>

            <div style={insightGridStyle}>

              <div style={insightBoxStyle}>
                <strong
                  style={{
                    display: "block",
                    fontSize: "25px",
                    marginBottom: "6px",
                  }}
                >
                  {activeCases}
                </strong>

                <span style={{ fontSize: "14px" }}>
                  cases currently require attention.
                </span>
              </div>

              <div
                style={{
                  ...insightBoxStyle,
                  background: "#fff7ed",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    fontSize: "25px",
                    marginBottom: "6px",
                  }}
                >
                  {criticalCases}
                </strong>

                <span style={{ fontSize: "14px" }}>
                  critical cases require priority response.
                </span>
              </div>

              <div
                style={{
                  ...insightBoxStyle,
                  background: "#eff6ff",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    fontSize: "25px",
                    marginBottom: "6px",
                  }}
                >
                  {rescueRate}%
                </strong>

                <span style={{ fontSize: "14px" }}>
                  of all cases are resolved or closed.
                </span>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default Analytics;