import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Activity,
  ChevronRight,
} from "lucide-react";
import Navbar from "../components/Navbar";

const API_URL = "http://localhost:8000";

function Dashboard() {
  const navigate = useNavigate();

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // -----------------------------------------
  // FETCH CASES
  // -----------------------------------------

  const fetchCases = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/cases`);

      if (!response.ok) {
        throw new Error("Unable to load rescue cases.");
      }

      const data = await response.json();

      setCases(data.cases || []);
    } catch (err) {
      console.error("Dashboard error:", err);

      setError(
        "Unable to connect to the PAWSignal backend. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  // -----------------------------------------
  // RESPONSE TIME HELPERS
  // -----------------------------------------

  const getDateValue = (item, fields) => {
    for (const field of fields) {
      const value = item?.[field];
      if (!value) continue;

      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return null;
  };

  const calculateAverageResponseMinutes = (caseList) => {
    const responseTimes = [];

    caseList.forEach((item) => {
      const directMinutes =
        item?.response_time_minutes ??
        item?.responseTimeMinutes ??
        item?.response_minutes ??
        item?.responseMinutes;

      if (
        directMinutes !== undefined &&
        directMinutes !== null &&
        Number.isFinite(Number(directMinutes)) &&
        Number(directMinutes) >= 0
      ) {
        responseTimes.push(Number(directMinutes));
        return;
      }

      const createdAt = getDateValue(item, [
        "created_at",
        "createdAt",
        "reported_at",
        "reportedAt",
        "timestamp",
      ]);

      const responseAt = getDateValue(item, [
        "assigned_at",
        "assignedAt",
        "response_at",
        "responseAt",
        "rescue_started_at",
        "rescueStartedAt",
        "rescued_at",
        "rescuedAt",
      ]);

      if (createdAt && responseAt) {
        const minutes =
          (responseAt.getTime() - createdAt.getTime()) /
          (1000 * 60);

        if (Number.isFinite(minutes) && minutes >= 0) {
          responseTimes.push(minutes);
        }
      }
    });

    if (!responseTimes.length) return null;

    return (
      responseTimes.reduce((sum, value) => sum + value, 0) /
      responseTimes.length
    );
  };

  const formatResponseTime = (minutes) => {
    if (!Number.isFinite(minutes) || minutes < 0) return "—";
    if (minutes < 1) return "<1 min";
    if (minutes < 60) return `${Math.round(minutes)} min`;

    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins === 0 ? `${hours} hr` : `${hours}h ${mins}m`;
  };

  // -----------------------------------------
  // DASHBOARD STATISTICS
  // -----------------------------------------

  const stats = useMemo(() => {
    return {
      total: cases.length,
      critical: cases.filter((item) =>
        (item.priority || "").toUpperCase() === "CRITICAL"
      ).length,
      high: cases.filter((item) =>
        (item.priority || "").toUpperCase() === "HIGH"
      ).length,
      moderate: cases.filter((item) =>
        (item.priority || "").toUpperCase() === "MODERATE"
      ).length,
      resolved: cases.filter((item) => {
        const status = (item.status || "").toUpperCase();
        return status === "RESOLVED";
      }).length,
      averageResponse: formatResponseTime(
        calculateAverageResponseMinutes(cases)
      ),
    };
  }, [cases]);

  // -----------------------------------------
  // PRIORITY SORTING
  // -----------------------------------------

  const priorityOrder = {
    CRITICAL: 1,
    HIGH: 2,
    MODERATE: 3,
    LOW: 4,
  };

  const sortedCases = [...cases].sort(
    (a, b) =>
      (priorityOrder[a.priority] || 5) -
        (priorityOrder[b.priority] || 5) ||
      b.score - a.score
  );

  // -----------------------------------------
  // HELPERS
  // -----------------------------------------

  const getPriorityClass = (priority) => {
    return `dashboard-priority priority-${priority?.toLowerCase()}`;
  };

  const getStatusClass = (status) => {
    return `dashboard-status status-${status?.toLowerCase()}`;
  };

  const formatStatus = (status) => {
    if (!status) return "New";

    return status
      .toLowerCase()
      .replace("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  // -----------------------------------------
  // OPEN CASE DETAILS
  // -----------------------------------------

  const openCase = (caseId) => {
    navigate(`/case/${caseId}`);
  };

  // -----------------------------------------
  // UI
  // -----------------------------------------

  return (
    <div className="app">
      <Navbar />

      <main className="dashboard-page">

        {/* =====================================
            HEADER
        ====================================== */}

        <div className="dashboard-header">

          <div>
            <span className="eyebrow">
              <span className="pulse-dot"></span>
              RESCUE COMMAND CENTER
            </span>

            <h1>Rescue Dashboard</h1>

            <p>
              Monitor incoming animal welfare cases and prioritize
              the animals that need help most urgently.
            </p>
          </div>

          <button
            type="button"
            className="dashboard-refresh"
            onClick={fetchCases}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "spin" : ""}
            />

            Refresh cases
          </button>

        </div>


        {/* =====================================
            STATISTICS
        ====================================== */}

        <section className="dashboard-stats">

          {/* TOTAL */}

          <div className="dashboard-stat-card">

            <div className="stat-icon stat-icon-total">
              <Activity size={20} />
            </div>

            <div>
              <span>Total cases</span>
              <strong>{stats.total}</strong>
            </div>

          </div>


          {/* CRITICAL */}

          <div className="dashboard-stat-card critical-stat">

            <div className="stat-icon stat-icon-critical">
              <ShieldAlert size={20} />
            </div>

            <div>
              <span>Critical</span>
              <strong>{stats.critical}</strong>
            </div>

          </div>


          {/* HIGH */}

          <div className="dashboard-stat-card high-stat">

            <div className="stat-icon stat-icon-high">
              <AlertTriangle size={20} />
            </div>

            <div>
              <span>High priority</span>
              <strong>{stats.high}</strong>
            </div>

          </div>


          {/* MODERATE */}

          <div className="dashboard-stat-card moderate-stat">

            <div className="stat-icon stat-icon-moderate">
              <Clock3 size={20} />
            </div>

            <div>
              <span>Moderate</span>
              <strong>{stats.moderate}</strong>
            </div>

          </div>


          {/* RESOLVED */}

          <div className="dashboard-stat-card resolved-stat">

            <div className="stat-icon stat-icon-resolved">
              <CheckCircle2 size={20} />
            </div>

            <div>
              <span>Resolved</span>
              <strong>{stats.resolved}</strong>
            </div>

          </div>


          {/* AVERAGE RESPONSE */}

          <div className="dashboard-stat-card response-stat">

            <div className="stat-icon stat-icon-response">
              <Clock3 size={20} />
            </div>

            <div>
              <span>Avg. response</span>
              <strong>{stats.averageResponse}</strong>
            </div>

          </div>

        </section>


        {/* =====================================
            CASE QUEUE
        ====================================== */}

        <section className="dashboard-main-card">

          <div className="dashboard-card-header">

            <div>
              <span className="section-label">
                LIVE CASE QUEUE
              </span>

              <h2>Cases requiring attention</h2>

              <p>
                Cases are automatically ordered by PAWScore
                priority.
              </p>
            </div>

            <div className="queue-count">
              {cases.length}{" "}
              {cases.length === 1 ? "case" : "cases"}
            </div>

          </div>


          {/* LOADING */}

          {loading ? (

            <div className="dashboard-loading">

              <div className="loading-spinner dark-spinner"></div>

              <p>Loading rescue cases...</p>

            </div>

          ) : error ? (

            /* ERROR */

            <div className="dashboard-error">

              <AlertTriangle size={20} />

              <p>{error}</p>

              <button
                type="button"
                onClick={fetchCases}
              >
                Try again
              </button>

            </div>

          ) : sortedCases.length === 0 ? (

            /* EMPTY */

            <div className="dashboard-empty">

              <div className="empty-icon">
                <CheckCircle2 size={26} />
              </div>

              <h3>No active rescue cases</h3>

              <p>
                New animal distress reports will appear here
                automatically.
              </p>

            </div>

          ) : (

            /* CASE TABLE */

            <div className="case-table-wrapper">

              <table className="case-table">

                <thead>

                  <tr>
                    <th>CASE</th>
                    <th>ANIMAL</th>
                    <th>PAWSCORE</th>
                    <th>PRIORITY</th>
                    <th>LOCATION</th>
                    <th>STATUS</th>
                    <th></th>
                  </tr>

                </thead>


                <tbody>

                  {sortedCases.map((item) => (

                    <tr key={item.case_id}>

                      {/* CASE ID */}

                      <td>

                        <div className="case-id">
                          {item.case_id}
                        </div>

                      </td>


                      {/* ANIMAL */}

                      <td>

                        <div className="animal-cell">

                          <div className="animal-avatar">

                            {item.species
                              ?.charAt(0)
                              ?.toUpperCase() || "A"}

                          </div>

                          <div>

                            <strong>
                              {item.species || "Unknown"}
                            </strong>

                            <span>
                              Confidence{" "}
                              {Math.round(
                                (item.confidence || 0) * 100
                              )}
                              %
                            </span>

                          </div>

                        </div>

                      </td>


                      {/* SCORE */}

                      <td>

                        <div className="score-cell">

                          <strong>
                            {item.score}
                          </strong>

                          <span>/100</span>

                        </div>

                      </td>


                      {/* PRIORITY */}

                      <td>

                        <span
                          className={getPriorityClass(
                            item.priority
                          )}
                        >
                          {item.priority}
                        </span>

                      </td>


                      {/* LOCATION */}

                      <td>

                        <div className="location-cell">

                          <MapPin size={14} />

                          <span>

                            {item.location?.latitude &&
                            item.location?.longitude
                              ? `${Number(
                                  item.location.latitude
                                ).toFixed(4)}, ${Number(
                                  item.location.longitude
                                ).toFixed(4)}`
                              : "Location unavailable"}

                          </span>

                        </div>

                      </td>


                      {/* STATUS */}

                      <td>

                        <span
                          className={getStatusClass(
                            item.status
                          )}
                        >

                          <span className="status-dot"></span>

                          {formatStatus(item.status)}

                        </span>

                      </td>


                      {/* VIEW CASE */}

                      <td>

                        <button
                          type="button"
                          className="case-view-button"
                          title="View case"
                          onClick={() =>
                            openCase(item.case_id)
                          }
                        >

                          <ChevronRight size={17} />

                        </button>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </section>


        {/* =====================================
            PRIORITY GUIDE
        ====================================== */}

        <section className="dashboard-bottom">

          <div className="priority-guide">

            <div>

              <span className="section-label">
                PAWSCORE PRIORITY
              </span>

              <h3>
                How cases are prioritized
              </h3>

            </div>


            <div className="priority-guide-items">

              <div>
                <span className="guide-dot guide-critical"></span>
                <strong>80–100</strong>
                <span>Critical</span>
              </div>

              <div>
                <span className="guide-dot guide-high"></span>
                <strong>60–79</strong>
                <span>High</span>
              </div>

              <div>
                <span className="guide-dot guide-moderate"></span>
                <strong>35–59</strong>
                <span>Moderate</span>
              </div>

              <div>
                <span className="guide-dot guide-low"></span>
                <strong>0–34</strong>
                <span>Low</span>
              </div>

            </div>

          </div>


          {/* RESPONDER NOTE */}

          <div className="dashboard-note">

            <ShieldAlert size={18} />

            <div>

              <strong>
                Responder guidance
              </strong>

              <p>
                PAWSignal provides AI-assisted triage based on
                visible welfare indicators. Human responders and
                veterinary professionals make the final
                intervention decision.
              </p>

            </div>

          </div>

        </section>

      </main>
    </div>
  );
}

export default Dashboard;