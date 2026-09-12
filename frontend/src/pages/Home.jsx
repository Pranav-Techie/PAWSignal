import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Camera,
  HeartPulse,
  MapPinned,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
  
function Home() {
  const [cases, setCases] = useState([]);
  const [averageResponseMinutes, setAverageResponseMinutes] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchHomeStats = async () => {
      try {
        setLoadingStats(true);

        const [casesResponse, statsResponse] = await Promise.all([
          fetch(`${API_URL}/cases`),
          fetch(`${API_URL}/statistics`),
        ]);

        if (!casesResponse.ok) {
          throw new Error("Unable to load case statistics.");
        }

        const casesData = await casesResponse.json();
        setCases(casesData.cases || []);

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();

          setAverageResponseMinutes(
            statsData?.response?.average_minutes ?? null
          );
        }
      } catch (error) {
        console.error("Home statistics error:", error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchHomeStats();
  }, []);

  // ----------------------------------------------------------
  // GET TIMESTAMP FROM COMMON BACKEND FIELD NAMES
  // ----------------------------------------------------------

  const getDateValue = (item, fields) => {
    for (const field of fields) {
      const value = item?.[field];

      if (value) {
        const date = new Date(value);

        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  };

  // ----------------------------------------------------------
  // CALCULATE AVERAGE RESPONSE TIME
  // ----------------------------------------------------------

  const calculateAverageResponse = (caseList) => {
    const responseTimes = [];

    caseList.forEach((item) => {
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
        "rescue_started_at",
        "rescueStartedAt",
        "rescued_at",
        "rescuedAt",
        "response_at",
        "responseAt",
      ]);

      const directMinutes =
        item?.response_time_minutes ??
        item?.responseTimeMinutes ??
        item?.response_minutes ??
        item?.responseMinutes;

      if (
        directMinutes !== undefined &&
        directMinutes !== null &&
        !Number.isNaN(Number(directMinutes))
      ) {
        responseTimes.push(Number(directMinutes));
        return;
      }

      if (createdAt && responseAt) {
        const differenceMinutes =
          (responseAt.getTime() - createdAt.getTime()) /
          (1000 * 60);

        if (
          differenceMinutes >= 0 &&
          Number.isFinite(differenceMinutes)
        ) {
          responseTimes.push(differenceMinutes);
        }
      }
    });

    if (responseTimes.length === 0) {
      return "—";
    }

    const average =
      responseTimes.reduce(
        (sum, value) => sum + value,
        0
      ) / responseTimes.length;

    if (average < 1) {
      return "<1 min";
    }

    if (average < 60) {
      return `${Math.round(average)} min`;
    }

    const hours = Math.floor(average / 60);
    const minutes = Math.round(average % 60);

    if (minutes === 0) {
      return `${hours} hr`;
    }

    return `${hours}h ${minutes}m`;
  };

  // ----------------------------------------------------------
  // FORMAT BACKEND RESPONSE TIME
  // ----------------------------------------------------------

  const formatResponseTime = (minutes) => {
    const value = Number(minutes);

    if (!Number.isFinite(value) || value < 0) {
      return "—";
    }

    if (value < 1) {
      return "<1 min";
    }

    if (value < 60) {
      return `${Math.round(value)} min`;
    }

    const hours = Math.floor(value / 60);
    const mins = Math.round(value % 60);

    return mins === 0
      ? `${hours} hr`
      : `${hours}h ${mins}m`;
  };

  // ----------------------------------------------------------
  // STATISTICS
  // ----------------------------------------------------------

  const stats = useMemo(() => {
    const totalCases = cases.length;

    const criticalCases = cases.filter(
      (item) =>
        item.priority?.toUpperCase() === "CRITICAL"
    ).length;

    const rescuedCases = cases.filter((item) => {
      const status = item.status?.toUpperCase();

      return (
        status === "RESCUED" ||
        status === "RESOLVED"
      );
    }).length;

    const averageResponse =
      averageResponseMinutes != null
        ? formatResponseTime(averageResponseMinutes)
        : calculateAverageResponse(cases);

    return {
      totalCases,
      criticalCases,
      rescuedCases,
      averageResponse,
    };
  }, [cases, averageResponseMinutes]);

  return (
    <div className="app">
      <Navbar />

      <main>

        {/* ==================================================
            HERO
        ================================================== */}

        <section className="hero">

          <div className="hero-content">

            <div className="eyebrow">
              <span className="pulse-dot"></span>
              AI-POWERED ANIMAL WELFARE
            </div>

            <h1>
              Every animal in distress
              <span> deserves a signal.</span>
            </h1>

            <p className="hero-description">
              PAWSignal uses AI-assisted welfare assessment
              to identify, prioritize and coordinate rescue
              cases before they become emergencies.
            </p>

            <div className="hero-actions">

              <Link
                to="/report"
                className="primary-button"
              >
                Report an Animal
                <ArrowRight size={18} />
              </Link>

              <Link
                to="/dashboard"
                className="secondary-button"
              >
                Open Rescue Dashboard
              </Link>

            </div>

            <div className="responder-entry">

              <span>
                Are you an NGO or rescue organization?
              </span>

              <Link
                to="/responder-dashboard"
                className="responder-entry-link"
              >
                Open Responder Dashboard
                <ArrowRight size={15} />
              </Link>

            </div>

            <div className="hero-trust">
              <ShieldCheck size={17} />

              <span>
                AI-assisted assessment • Human-led rescue
              </span>
            </div>

          </div>

          {/* ==================================================
              HERO CARD
          ================================================== */}

          <div className="hero-card">

            <div className="card-top">

              <div>

                <span className="small-label">
                  LIVE TRIAGE
                </span>

                <h3>PAWScore</h3>

              </div>

              <div className="status-pill critical">
                CRITICAL
              </div>

            </div>

            <div className="score">
              <strong>94</strong>
              <span>/100</span>
            </div>

            <div className="score-bar">
              <div className="score-fill"></div>
            </div>

            <div className="detection-list">

              <div>
                <span>Possible injury</span>
                <strong>High</strong>
              </div>

              <div>
                <span>Mobility impairment</span>
                <strong>Severe</strong>
              </div>

              <div>
                <span>Environmental danger</span>
                <strong>Roadside</strong>
              </div>

            </div>

            <div className="ai-note">

              <Activity size={17} />

              <span>
                Immediate veterinary assessment recommended
              </span>

            </div>

          </div>

        </section>

        {/* ==================================================
            LIVE STATISTICS
        ================================================== */}

        <section className="stats-section">

          <div className="stat-card">

            <HeartPulse size={23} />

            <div>

              <strong>
                {loadingStats
                  ? "—"
                  : stats.totalCases}
              </strong>

              <span>
                Cases reported
              </span>

            </div>

          </div>

          <div className="stat-card">

            <Activity size={23} />

            <div>

              <strong>
                {loadingStats
                  ? "—"
                  : stats.criticalCases}
              </strong>

              <span>
                Critical cases
              </span>

            </div>

          </div>

          <div className="stat-card">

            <ShieldCheck size={23} />

            <div>

              <strong>
                {loadingStats
                  ? "—"
                  : stats.rescuedCases}
              </strong>

              <span>
                Animals rescued
              </span>

            </div>

          </div>

          <div className="stat-card">

            <MapPinned size={23} />

            <div>

              <strong>
                {loadingStats
                  ? "—"
                  : stats.averageResponse}
              </strong>

              <span>
                Avg. response
              </span>

            </div>

          </div>

        </section>

        {/* ==================================================
            HOW PAWSIGNAL WORKS
        ================================================== */}

        <section className="features">

          <div className="section-heading">

            <span className="eyebrow">
              HOW PAWSIGNAL WORKS
            </span>

            <h2>
              From report to rescue.
            </h2>

            <p>
              One system connecting public reports,
              AI-assisted triage and rescue response.
            </p>

          </div>

          <div className="feature-grid">

            <div className="feature-card">

              <div className="feature-icon">
                <Camera />
              </div>

              <span>01</span>

              <h3>
                Report
              </h3>

              <p>
                Upload a photo or video of an animal
                in distress and provide its location.
              </p>

            </div>

            <div className="feature-card">

              <div className="feature-icon">
                <Activity />
              </div>

              <span>02</span>

              <h3>
                Assess
              </h3>

              <p>
                AI analyzes visible welfare indicators
                and generates a transparent urgency score.
              </p>

            </div>

            <div className="feature-card">

              <div className="feature-icon">
                <MapPinned />
              </div>

              <span>03</span>

              <h3>
                Prioritize
              </h3>

              <p>
                Critical cases are surfaced first and
                duplicate reports can be grouped together.
              </p>

            </div>

            <div className="feature-card">

              <div className="feature-icon">
                <HeartPulse />
              </div>

              <span>04</span>

              <h3>
                Rescue
              </h3>

              <p>
                Responders can accept cases, track
                progress and record the final outcome.
              </p>

            </div>

          </div>

        </section>

      </main>
    </div>
  );
}

export default Home;