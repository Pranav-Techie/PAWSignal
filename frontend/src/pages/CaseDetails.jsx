import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserRound,
  Activity,
  Sparkles,
} from "lucide-react";
import Navbar from "../components/Navbar";

const API_URL = "http://localhost:8000";

function CaseDetails() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // View Case from the responder dashboard is intentionally a
  // read-only case/animal detail view. It must not show the
  // reporter-side responder matching cards.
  const isResponderView = Boolean(
    location.state?.fromResponderDashboard
  );

  const [caseData, setCaseData] = useState(null);

  // AI recommended responder
  const [recommendedResponder, setRecommendedResponder] =
    useState(null);

  // Other responders returned by matching API
  const [alternativeResponders, setAlternativeResponders] =
    useState([]);

  // User-selected responder
  const [selectedResponder, setSelectedResponder] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // FETCH CASE
  // --------------------------------------------------

  const fetchCase = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/cases/${caseId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Case not found."
        );
      }

      setCaseData(data);
    } catch (err) {
      console.error(err);

      setError(
        err.message || "Unable to load case."
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // FETCH RESPONDER MATCHES
  // --------------------------------------------------

  const fetchRecommendedResponder = async () => {
    try {
      const response = await fetch(
        `${API_URL}/cases/${caseId}/match`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to find responders."
        );
      }

      if (
        data.match_found &&
        data.recommended_responder
      ) {
        setRecommendedResponder(
          data.recommended_responder
        );

        setAlternativeResponders(
          data.alternative_responders || []
        );

        // Initially select AI recommendation
        setSelectedResponder(
          data.recommended_responder
        );
      } else {
        setRecommendedResponder(null);

        setAlternativeResponders(
          data.alternative_responders || []
        );

        setSelectedResponder(null);
      }
    } catch (err) {
      console.error(
        "Responder match error:",
        err
      );

      setRecommendedResponder(null);
      setAlternativeResponders([]);
      setSelectedResponder(null);
    }
  };

  // --------------------------------------------------
  // INITIAL LOAD
  // --------------------------------------------------

  useEffect(() => {
    const loadCase = async () => {
      await fetchCase();

      if (!isResponderView) {
        await fetchRecommendedResponder();
      } else {
        setRecommendedResponder(null);
        setAlternativeResponders([]);
        setSelectedResponder(null);
      }
    };

    loadCase();
  }, [caseId, isResponderView]);

  // --------------------------------------------------
  // UPDATE STATUS
  // --------------------------------------------------

  const updateStatus = async (newStatus) => {
    try {
      setUpdating(true);
      setError("");

      const response = await fetch(
        `${API_URL}/cases/${caseId}/status?status=${newStatus}`,
        {
          method: "PATCH",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to update status."
        );
      }

      await fetchCase();

      if (!isResponderView) {
        await fetchRecommendedResponder();
      }
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Status update failed."
      );
    } finally {
      setUpdating(false);
    }
  };

  // --------------------------------------------------
  // ASSIGN SELECTED RESPONDER
  // --------------------------------------------------

  const assignSelectedResponder = async () => {
    if (!selectedResponder) {
      setError(
        "Please select a responder first."
      );
      return;
    }

    try {
      setAssigning(true);
      setError("");

      /*
       * IMPORTANT:
       * This assumes your backend supports:
       *
       * POST /cases/{caseId}/assign
       *
       * with:
       * {
       *   "responder_id": "..."
       * }
       *
       * If your backend endpoint is different,
       * only this fetch needs to be changed.
       */

      const response = await fetch(
        `${API_URL}/cases/${caseId}/assign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            responder_id:
              selectedResponder.responder_id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to assign responder."
        );
      }

      if (data.assigned === false) {
        throw new Error(
          data.message ||
            "Responder could not be assigned."
        );
      }

      await fetchCase();
      await fetchRecommendedResponder();
    } catch (err) {
      console.error(
        "Assignment error:",
        err
      );

      setError(
        err.message ||
          "Responder assignment failed."
      );
    } finally {
      setAssigning(false);
    }
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="app">
        <Navbar />

        <main className="case-details-page">
          <div className="case-loading">
            <div className="loading-spinner"></div>

            <p>
              Loading case details...
            </p>
          </div>
        </main>
      </div>
    );
  }

  // --------------------------------------------------
  // ERROR
  // --------------------------------------------------

  if (error && !caseData) {
    return (
      <div className="app">
        <Navbar />

        <main className="case-details-page">
          <div className="case-error">
            <div className="case-error-icon">
              <AlertTriangle size={24} />
            </div>

            <h2>
              Unable to load case
            </h2>

            <p>{error}</p>

            <button
              className="case-back-action"
              onClick={() =>
                navigate("/dashboard")
              }
            >
              <ArrowLeft size={16} />
              Back to dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  // --------------------------------------------------
  // CASE DATA
  // --------------------------------------------------

  const priority =
    caseData.priority?.toUpperCase() ||
    "MODERATE";

  const priorityClass =
    priority.toLowerCase();

  const status =
    caseData.status?.toUpperCase() ||
    "NEW";

  const confidence = Math.round(
    (caseData.confidence || 0) * 100
  );

  const coordinates =
    caseData.location?.latitude != null &&
    caseData.location?.longitude != null
      ? `${caseData.location.latitude}, ${caseData.location.longitude}`
      : "Location unavailable";

  // --------------------------------------------------
  // STATUS STEPS
  // --------------------------------------------------

  const statusSteps = [
    {
      key: "NEW",
      label: "New",
      icon: Activity,
    },
    {
      key: "ASSIGNED",
      label: "Assigned",
      icon: UserRound,
    },
    {
      key: "RESCUED",
      label: "Rescued",
      icon: ShieldCheck,
    },
    {
      key: "RESOLVED",
      label: "Resolved",
      icon: CheckCircle2,
    },
  ];

  const statusIndex =
    statusSteps.findIndex(
      (step) => step.key === status
    );

  // --------------------------------------------------
  // NEXT STATUS ACTION
  // --------------------------------------------------

  const getNextAction = () => {
    if (status === "ASSIGNED") {
      return {
        label: "Mark as Rescued",
        next: "RESCUED",
        icon: ShieldCheck,
      };
    }

    if (status === "RESCUED") {
      return {
        label: "Mark as Resolved",
        next: "RESOLVED",
        icon: CheckCircle2,
      };
    }

    return null;
  };

  const nextAction =
    getNextAction();

  // --------------------------------------------------
  // ASSIGNMENT STATE
  // --------------------------------------------------

  const isAssigned =
    status === "ASSIGNED" ||
    status === "RESCUED" ||
    status === "RESOLVED";

  // --------------------------------------------------
  // RESPONDER DATA
  // --------------------------------------------------

  const responderMatchScore =
    recommendedResponder?.match_score;

  const responderDistance =
    recommendedResponder?.distance_km;

  const responderRadius =
    recommendedResponder?.service_radius_km;

  const matchQuality =
    responderMatchScore >= 80
      ? "EXCELLENT"
      : responderMatchScore >= 60
      ? "GOOD"
      : "FAIR";

  // --------------------------------------------------
  // COMBINE ALL RESPONDERS
  // --------------------------------------------------

  const allResponders = [];

  if (recommendedResponder) {
    allResponders.push({
      ...recommendedResponder,
      is_ai_recommended: true,
    });
  }

  alternativeResponders.forEach(
    (responder) => {
      const alreadyExists =
        allResponders.some(
          (item) =>
            item.responder_id ===
            responder.responder_id
        );

      if (!alreadyExists) {
        allResponders.push({
          ...responder,
          is_ai_recommended: false,
        });
      }
    }
  );

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="app">
      <Navbar />

      <main className="case-details-page">

        {/* BACK */}

        <button
          className="back-button"
          onClick={() =>
            navigate(
              isResponderView
                ? "/responder-dashboard"
                : "/dashboard"
            )
          }
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </button>

        {/* ERROR */}

        {error && (
          <div className="case-inline-error">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {/* HEADER */}

        <header className="case-details-header">
          <div className="case-header-left">
            <span className="eyebrow">
              <span className="pulse-dot"></span>
              CASE DETAILS
            </span>

            <h1>
              {caseData.case_id}
            </h1>

            <p>
              AI-assisted welfare assessment
              and rescue coordination.
            </p>
          </div>

          <div
            className={`case-header-priority priority-${priorityClass}`}
          >
            {priority}
          </div>
        </header>

        {/* MAIN GRID */}

        <div className="case-details-grid">

          {/* ==========================================
              LEFT COLUMN
          ========================================== */}

          <div className="case-main-column">

            {/* PAWSCORE */}

            <section
              className={`case-score-card priority-card-${priorityClass}`}
            >
              <div className="score-card-top">
                <div>
                  <span className="case-card-label">
                    PAWSCORE
                  </span>

                  <div className="score-value">
                    {caseData.score}
                    <span>/100</span>
                  </div>
                </div>

                <div className="score-icon">
                  <Activity size={22} />
                </div>
              </div>

              <div
                className={`priority-badge priority-${priorityClass}`}
              >
                {priority}
              </div>

              <div className="score-divider"></div>

              <p className="score-recommendation">
                {caseData.recommendation}
              </p>
            </section>

            {/* CASE INFORMATION */}

            <section className="case-panel">
              <div className="panel-header">
                <div className="panel-icon">
                  <ShieldCheck size={18} />
                </div>

                <div>
                  <h2>
                    Case information
                  </h2>

                  <span>
                    AI confidence {confidence}%
                  </span>
                </div>
              </div>

              <div className="case-info-grid">

                <div className="info-item">
                  <span>Animal</span>

                  <strong>
                    {caseData.species ||
                      "Unknown"}
                  </strong>
                </div>

                <div className="info-item">
                  <span>
                    Visible injury
                  </span>

                  <strong>
                    {caseData.visible_injury
                      ? "Detected"
                      : "Not detected"}
                  </strong>
                </div>

                <div className="info-item">
                  <span>
                    Injury severity
                  </span>

                  <strong>
                    {caseData.injury_severity}/5
                  </strong>
                </div>

                <div className="info-item">
                  <span>
                    Mobility impairment
                  </span>

                  <strong>
                    {caseData.mobility_impairment}/5
                  </strong>
                </div>

                <div className="info-item">
                  <span>
                    Bleeding indicator
                  </span>

                  <strong>
                    {caseData.bleeding}/5
                  </strong>
                </div>

                <div className="info-item">
                  <span>
                    Environmental danger
                  </span>

                  <strong>
                    {caseData.environmental_danger}/5
                  </strong>
                </div>

                <div className="info-item">
                  <span>
                    Vulnerability
                  </span>

                  <strong>
                    {caseData.vulnerability}/5
                  </strong>
                </div>

              </div>
            </section>

            {/* WHY URGENT */}

            <section className="case-panel urgent-panel">
              <div className="panel-title-only">

                <span className="section-label">
                  PAWSCORE EXPLANATION
                </span>

                <h2>
                  Why is this case urgent?
                </h2>

                <p>
                  PAWSignal calculated the
                  priority from visible
                  welfare indicators.
                </p>

              </div>

              <div className="reason-list">
                {caseData.reasons?.map(
                  (reason, index) => (
                    <div
                      className="reason-item"
                      key={index}
                    >
                      <span className="reason-number">
                        {index + 1}
                      </span>

                      <span className="reason-text">
                        {reason}
                      </span>
                    </div>
                  )
                )}
              </div>
            </section>

            {/* AI OBSERVATIONS */}

            <section className="case-panel">
              <div className="panel-title-only">

                <span className="section-label">
                  AI VISION ANALYSIS
                </span>

                <h2>
                  What the AI observed
                </h2>

                <p>
                  Observable indicators
                  identified from the
                  submitted image.
                </p>

              </div>

              <div className="observation-list">
                {caseData.observations?.map(
                  (observation, index) => (
                    <div
                      className="observation-item"
                      key={index}
                    >
                      <CheckCircle2 size={17} />

                      <span>
                        {observation}
                      </span>
                    </div>
                  )
                )}
              </div>
            </section>

          </div>

          {/* ==========================================
              RIGHT COLUMN
          ========================================== */}

          <aside className="case-side-column">

            {/* PRIORITY SUMMARY */}

            <section
              className={`priority-summary priority-summary-${priorityClass}`}
            >
              <span className="summary-label">
                PRIORITY
              </span>

              <strong>
                {priority}
              </strong>

              <span className="summary-score">
                PAWScore {caseData.score}/100
              </span>
            </section>

            {/* RESCUE STATUS */}

            <section className="case-panel status-panel">

              <div className="panel-header">
                <div className="panel-icon">
                  <Clock size={18} />
                </div>

                <div>
                  <h2>
                    Rescue status
                  </h2>

                  <span>
                    Current status:{" "}
                    <strong>
                      {status}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="status-timeline">

                {statusSteps.map(
                  (step, index) => {
                    const Icon =
                      step.icon;

                    const isComplete =
                      statusIndex >= index;

                    const isCurrent =
                      status === step.key;

                    return (
                      <div
                        className={`timeline-step ${
                          isComplete
                            ? "complete"
                            : ""
                        } ${
                          isCurrent
                            ? "current"
                            : ""
                        }`}
                        key={step.key}
                      >
                        <div className="timeline-marker">
                          {isComplete ? (
                            <Icon size={14} />
                          ) : (
                            index + 1
                          )}
                        </div>

                        <div className="timeline-content">
                          <strong>
                            {step.label}
                          </strong>

                          {isCurrent && (
                            <span>
                              Current stage
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}

              </div>

              <div className="status-actions">

                {nextAction && (
                  <button
                    className="primary-action"
                    onClick={() =>
                      updateStatus(
                        nextAction.next
                      )
                    }
                    disabled={updating}
                  >
                    {(() => {
                      const NextIcon =
                        nextAction.icon;

                      return (
                        <NextIcon size={17} />
                      );
                    })()}

                    {updating
                      ? "Updating..."
                      : nextAction.label}
                  </button>
                )}

                {status === "RESOLVED" && (
                  <div className="resolved-message">
                    <CheckCircle2 size={17} />

                    <span>
                      Case successfully
                      resolved
                    </span>
                  </div>
                )}

              </div>
            </section>

            {/* ==========================================
                RESPONDER SELECTION
            ========================================== */}

            {!isResponderView && status === "NEW" && (
              <section className="case-panel responder-recommendation">

                <div className="panel-header">
                  <div className="panel-icon">
                    <UserRound size={18} />
                  </div>

                  <div>
                    <h2>
                      Responder selection
                    </h2>

                    <span>
                      AI recommends the best match,
                      but you can choose another.
                    </span>
                  </div>
                </div>

                {/* AI ATTEMPT */}

                {recommendedResponder && (
                  <div className="ai-recommendation-banner">
                    <Sparkles size={16} />

                    <div>
                      <strong>
                        AI Recommendation
                      </strong>

                      <span>
                        PAWSignal selected{" "}
                        <b>
                          {
                            recommendedResponder.name
                          }
                        </b>{" "}
                        as the best available match.
                      </span>
                    </div>
                  </div>
                )}

                {/* RESPONDER OPTIONS */}

                <div className="responder-options">

                  {allResponders.length === 0 ? (
                    <div className="no-responder-options">
                      <AlertTriangle size={18} />

                      <div>
                        <strong>
                          No responders available
                        </strong>

                        <span>
                          No verified responder was
                          found for this case.
                        </span>
                      </div>
                    </div>
                  ) : (
                    allResponders.map(
                      (responder) => {
                        const isSelected =
                          selectedResponder?.responder_id ===
                          responder.responder_id;

                        const score =
                          responder.match_score;

                        const quality =
                          score >= 80
                            ? "EXCELLENT"
                            : score >= 60
                            ? "GOOD"
                            : "FAIR";

                        return (
                          <button
                            type="button"
                            key={
                              responder.responder_id
                            }
                            className={`responder-option ${
                              isSelected
                                ? "selected"
                                : ""
                            }`}
                            onClick={() =>
                              setSelectedResponder(
                                responder
                              )
                            }
                          >

                            {/* TOP */}

                            <div className="responder-option-top">

                              <div className="responder-option-name">
                                <strong>
                                  {
                                    responder.name
                                  }
                                </strong>

                                {responder.verified && (
                                  <span className="verified-badge">
                                    <ShieldCheck size={12} />
                                    Verified
                                  </span>
                                )}
                              </div>

                              {responder.is_ai_recommended && (
                                <span className="ai-badge">
                                  <Sparkles size={12} />
                                  AI Recommended
                                </span>
                              )}

                            </div>

                            {/* TYPE */}

                            <span className="responder-type">
                              {
                                responder.responder_type
                              }
                            </span>

                            {/* DETAILS */}

                            <div className="responder-option-details">

                              <div>
                                <span>
                                  MATCH
                                </span>

                                <strong>
                                  {score != null
                                    ? `${score}%`
                                    : "N/A"}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  QUALITY
                                </span>

                                <strong>
                                  {quality}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  DISTANCE
                                </span>

                                <strong>
                                  {typeof responder.distance_km ===
                                  "number"
                                    ? `${responder.distance_km.toFixed(
                                        2
                                      )} km`
                                    : "N/A"}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  AVAILABILITY
                                </span>

                                <strong className="available-text">
                                  {
                                    responder.availability ||
                                    "AVAILABLE"
                                  }
                                </strong>
                              </div>

                            </div>

                            {/* SPECIALIZATION */}

                            <div className="responder-option-bottom">

                              <span>
                                SPECIALIZATION
                              </span>

                              <strong>
                                {
                                  responder.specialization ||
                                  "General Rescue"
                                }
                              </strong>

                            </div>

                            {/* SELECTION */}

                            <div className="responder-select-indicator">

                              <span
                                className={`radio-circle ${
                                  isSelected
                                    ? "checked"
                                    : ""
                                }`}
                              >
                                {isSelected && (
                                  <span />
                                )}
                              </span>

                              <span>
                                {isSelected
                                  ? "Selected responder"
                                  : "Select responder"}
                              </span>

                            </div>

                          </button>
                        );
                      }
                    )
                  )}

                </div>

                {/* ASSIGN SELECTED */}

                {selectedResponder &&
                  allResponders.length > 0 && (
                    <div className="selected-responder-summary">

                      <div>
                        <span>
                          RESPONDER TO ASSIGN
                        </span>

                        <strong>
                          {
                            selectedResponder.name
                          }
                        </strong>
                      </div>

                      <button
                        className="primary-action"
                        onClick={
                          assignSelectedResponder
                        }
                        disabled={assigning}
                      >
                        <UserRound size={17} />

                        {assigning
                          ? "Assigning..."
                          : "Assign Selected Responder"}
                      </button>

                    </div>
                  )}

              </section>
            )}

            {/* ==========================================
                ASSIGNED RESPONDER
            ========================================== */}

            {!isResponderView &&
              isAssigned &&
              selectedResponder && (
                <section className="case-panel responder-recommendation">

                  <div className="panel-header">
                    <div className="panel-icon">
                      <UserRound size={18} />
                    </div>

                    <div>
                      <h2>
                        Assigned responder
                      </h2>

                      <span>
                        Responder currently
                        handling this case
                      </span>
                    </div>
                  </div>

                  <div className="recommended-responder">

                    <div className="responder-name-row">

                      <strong>
                        {
                          selectedResponder.name
                        }
                      </strong>

                      {selectedResponder.verified && (
                        <span className="verified-badge">
                          <ShieldCheck size={13} />
                          Verified
                        </span>
                      )}

                    </div>

                    <span className="responder-type">
                      {
                        selectedResponder.responder_type
                      }
                    </span>

                    <div className="assigned-message">
                      <CheckCircle2 size={17} />

                      <span>
                        Responder assigned
                        successfully
                      </span>
                    </div>

                  </div>

                </section>
              )}

            {/* LOCATION */}

            <section className="case-panel location-panel">

              <div className="panel-header">
                <div className="panel-icon">
                  <MapPin size={18} />
                </div>

                <div>
                  <h2>
                    Animal location
                  </h2>

                  <span>
                    Reported coordinates
                  </span>
                </div>
              </div>

              <div className="location-box">

                <MapPin size={17} />

                <div>
                  <strong>
                    {coordinates}
                  </strong>

                  <span>
                    Reported animal location
                  </span>
                </div>

              </div>

              {caseData.location?.latitude !=
                null &&
                caseData.location?.longitude !=
                  null && (
                  <a
                    className="map-link"
                    href={`https://www.google.com/maps?q=${caseData.location.latitude},${caseData.location.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open location in Maps →
                  </a>
                )}

            </section>

            {/* RESPONDER GUIDANCE */}

            {!isResponderView && (
              <section className="responder-card">

              <div className="responder-card-icon">
                <ShieldCheck size={18} />
              </div>

              <div>
                <strong>
                  Responder guidance
                </strong>

                <p>
                  PAWSignal uses AI to
                  recommend the most suitable
                  responder based on availability,
                  specialization, location and
                  case requirements. The reporter
                  or authorized operator can
                  override the recommendation and
                  select another suitable responder.
                </p>
              </div>

              </section>
            )}

          </aside>

        </div>

        {/* DISCLAIMER */}

        <div className="case-disclaimer">

          <AlertTriangle size={16} />

          <span>
            PAWSignal provides an AI-assisted
            welfare assessment based on visible
            indicators. It is not a veterinary
            diagnosis. Human responders and
            veterinary professionals make the
            final intervention decision.
          </span>

        </div>

      </main>
    </div>
  );
}

export default CaseDetails;