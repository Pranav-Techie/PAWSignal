import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Radio,
  Navigation,
  HeartPulse,
  ClipboardCheck,
} from "lucide-react";
import Navbar from "../components/Navbar";

const API_URL = "http://localhost:8000";

function ResponderDashboard() {
  const navigate = useNavigate();

  const [responders, setResponders] = useState([]);
  const [cases, setCases] = useState([]);

  const [selectedResponderId, setSelectedResponderId] = useState("");

  const [loading, setLoading] = useState(true);
  const [claimingCase, setClaimingCase] = useState(null);
  const [updatingCase, setUpdatingCase] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ==========================================================
  // BACKEND FIELD HELPERS
  // ==========================================================

  const getScore = (item) =>
    item?.score ??
    item?.paw_score ??
    item?.pawScore ??
    0;

  const getAnalysis = (item) =>
    item?.ai_analysis ??
    item?.aiAnalysis ??
    item?.analysis ??
    null;

  const getImageUrl = (item) => {
    const image =
      item?.image_url ??
      item?.imageUrl ??
      item?.image ??
      null;

    if (!image) return null;

    if (
      image.startsWith("http://") ||
      image.startsWith("https://")
    ) {
      return image;
    }

    if (image.startsWith("/uploads/")) {
      return `${API_URL}${image}`;
    }

    if (image.startsWith("uploads/")) {
      return `${API_URL}/${image}`;
    }

    return `${API_URL}/uploads/${image}`;
  };

  const getDistance = (item) =>
    item?.distance_km ??
    item?.distanceKm ??
    item?.distance ??
    null;

  const getMatchScore = (item) =>
    item?.match_score ??
    item?.matchScore ??
    null;

  const getPriority = (item) =>
    item?.priority ??
    "LOW";

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [respondersResponse, casesResponse] =
        await Promise.all([
          fetch(`${API_URL}/responders`),
          fetch(`${API_URL}/cases`),
        ]);

      if (!respondersResponse.ok) {
        throw new Error("Unable to load responder network.");
      }

      if (!casesResponse.ok) {
        throw new Error("Unable to load rescue cases.");
      }

      const respondersData =
        await respondersResponse.json();

      const casesData =
        await casesResponse.json();

      const responderList =
        respondersData.responders || [];

      const caseList =
        casesData.cases || [];

      setResponders(responderList);
      setCases(caseList);

      // Automatically select first available responder
      if (!selectedResponderId) {
        const firstAvailable =
          responderList.find(
            (responder) =>
              responder.verified &&
              responder.availability === "AVAILABLE"
          );

        if (firstAvailable) {
          setSelectedResponderId(
            firstAvailable.responder_id
          );
        }
      }
    } catch (err) {
      console.error(
        "Responder dashboard error:",
        err
      );

      setError(
        err.message ||
          "Unable to connect to PAWSignal backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ==========================================================
  // CURRENT RESPONDER
  // ==========================================================

  const currentResponder = useMemo(() => {
    return responders.find(
      (responder) =>
        responder.responder_id ===
        selectedResponderId
    );
  }, [responders, selectedResponderId]);

  // ==========================================================
  // PRIORITY ORDER
  // ==========================================================

  const priorityOrder = {
    CRITICAL: 1,
    HIGH: 2,
    MODERATE: 3,
    LOW: 4,
  };

  // ==========================================================
  // SORT CASES
  // ==========================================================

  const sortedCases = useMemo(() => {
    return [...cases].sort((a, b) => {
      const priorityA =
        priorityOrder[
          String(getPriority(a)).toUpperCase()
        ] || 5;

      const priorityB =
        priorityOrder[
          String(getPriority(b)).toUpperCase()
        ] || 5;

      return (
        priorityA - priorityB ||
        Number(getScore(b)) - Number(getScore(a))
      );
    });
  }, [cases]);

  // ==========================================================
  // NEW REQUESTS
  // ==========================================================

  const incomingCases = sortedCases.filter(
    (item) =>
      String(item.status || "NEW").toUpperCase() ===
      "NEW"
  );

  // ==========================================================
  // MY ACTIVE RESCUES
  // ==========================================================

  const myActiveCases = sortedCases.filter((item) => {
    const assignedResponder =
      item.assigned_responder ??
      item.assignedResponder ??
      null;

    const responderId =
      assignedResponder?.responder_id ??
      assignedResponder?.responderId ??
      item.assigned_responder_id ??
      item.assignedResponderId ??
      null;

    const status =
      String(item.status || "").toUpperCase();

    return (
      responderId === selectedResponderId &&
      (status === "ASSIGNED" ||
        status === "RESCUED")
    );
  });

  // ==========================================================
  // MY COMPLETED CASES
  // ==========================================================

  const myResolvedCases = sortedCases.filter((item) => {
    const assignedResponder =
      item.assigned_responder ??
      item.assignedResponder ??
      null;

    const responderId =
      assignedResponder?.responder_id ??
      assignedResponder?.responderId ??
      item.assigned_responder_id ??
      item.assignedResponderId ??
      null;

    return (
      responderId === selectedResponderId &&
      String(item.status || "").toUpperCase() ===
        "RESOLVED"
    );
  });

  // ==========================================================
  // STATISTICS
  // ==========================================================

  const stats = {
    requests: incomingCases.length,

    active: myActiveCases.filter(
      (item) =>
        String(item.status).toUpperCase() ===
        "ASSIGNED"
    ).length,

    rescued: myActiveCases.filter(
      (item) =>
        String(item.status).toUpperCase() ===
        "RESCUED"
    ).length,

    completed: myResolvedCases.length,
  };

  // ==========================================================
  // OPEN CASE DETAILS
  // ==========================================================

  const openCase = (caseId) => {
    navigate(`/case/${caseId}`, {
      state: {
        fromResponderDashboard: true,
        responderId: selectedResponderId,
      },
    });
  };

  // ==========================================================
  // CLAIM CASE
  // ==========================================================

  const claimCase = async (caseId) => {
    if (!selectedResponderId) {
      setError(
        "Please select a responder organization first."
      );
      return;
    }

    if (!currentResponder) {
      setError(
        "Responder profile could not be found."
      );
      return;
    }

    if (
      currentResponder.availability !==
      "AVAILABLE"
    ) {
      setError(
        "This responder is currently unavailable."
      );
      return;
    }

    try {
      setClaimingCase(caseId);
      setError("");
      setSuccess("");

      // ------------------------------------------------------
      // GET MATCH INFORMATION
      // ------------------------------------------------------

      const matchResponse = await fetch(
        `${API_URL}/cases/${caseId}/match`
      );

      if (!matchResponse.ok) {
        const matchError =
          await matchResponse.json().catch(() => ({}));

        console.warn(
          "Match evaluation warning:",
          matchError
        );
      }

      // ------------------------------------------------------
      // CLAIM CASE
      // ------------------------------------------------------

      const response = await fetch(
        `${API_URL}/cases/${caseId}/claim?responder_id=${encodeURIComponent(
          selectedResponderId
        )}`,
        {
          method: "POST",
        }
      );

      const data =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to accept this rescue request."
        );
      }

      setSuccess(
        "Rescue request accepted. The case is now assigned to your organization."
      );

      await fetchData();
    } catch (err) {
      console.error("Claim case error:", err);

      setError(
        err.message ||
          "Unable to accept rescue request."
      );
    } finally {
      setClaimingCase(null);
    }
  };

  // ==========================================================
  // UPDATE STATUS
  // ==========================================================

  const updateStatus = async (
    caseId,
    nextStatus
  ) => {
    try {
      setUpdatingCase(caseId);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/cases/${caseId}/status?status=${encodeURIComponent(
          nextStatus
        )}`,
        {
          method: "PATCH",
        }
      );

      const data =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to update rescue status."
        );
      }

      setSuccess(
        `Case marked as ${nextStatus.toLowerCase()}.`
      );

      await fetchData();
    } catch (err) {
      console.error(
        "Status update error:",
        err
      );

      setError(
        err.message ||
          "Unable to update rescue status."
      );
    } finally {
      setUpdatingCase(null);
    }
  };

  // ==========================================================
  // PRIORITY CLASS
  // ==========================================================

  const getPriorityClass = (priority) => {
    return `responder-priority responder-priority-${String(
      priority || "LOW"
    ).toLowerCase()}`;
  };

  // ==========================================================
  // STATUS CLASS
  // ==========================================================

  const getStatusClass = (status) => {
    return `responder-status responder-status-${String(
      status || "NEW"
    ).toLowerCase()}`;
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="app">
        <Navbar />

        <main className="responder-dashboard-page">
          <div className="responder-loading">
            <RefreshCw
              size={24}
              className="spin"
            />

            <p>
              Connecting to responder command
              center...
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="app">
      <Navbar />

      <main className="responder-dashboard-page">

        {/* ==================================================
            HEADER
        ================================================== */}

        <header className="responder-dashboard-header">
          <div>
            <span className="eyebrow">
              <span className="pulse-dot"></span>
              RESPONDER COMMAND CENTER
            </span>

            <h1>
              My Rescue Dashboard
            </h1>

            <p>
              Manage rescue requests assigned to
              your organization, respond to urgent
              cases, and track rescue operations from
              one place.
            </p>
          </div>

          <button
            className="responder-refresh"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "spin" : ""}
            />

            Refresh
          </button>
        </header>

        {/* ==================================================
            ALERTS
        ================================================== */}

        {error && (
          <div className="responder-alert responder-alert-error">
            <AlertTriangle size={17} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="responder-alert responder-alert-success">
            <CheckCircle2 size={17} />
            <span>{success}</span>
          </div>
        )}

        {/* ==================================================
            RESPONDER ORGANIZATION
        ================================================== */}

        <section className="responder-organization-card">
          <div className="organization-left">
            <div className="responder-profile-icon">
              <UserRound size={24} />
            </div>

            <div className="responder-profile-info">
              <span className="section-label">
                RESPONDER ORGANIZATION
              </span>

              <h2>
                {currentResponder?.name ||
                  "Rescue Organization"}
              </h2>

              <p>
                {currentResponder?.responder_type ||
                  "Animal Rescue"}{" "}
                •{" "}
                {currentResponder?.specialization ||
                  "General Animal Rescue"}
              </p>

              <div className="responder-profile-meta">
                <span
                  className={
                    currentResponder?.availability ===
                    "AVAILABLE"
                      ? "availability available"
                      : "availability busy"
                  }
                >
                  <span></span>

                  {currentResponder?.availability ||
                    "UNKNOWN"}
                </span>

                {currentResponder?.verified && (
                  <span className="verified-small">
                    <ShieldCheck size={14} />
                    Verified responder
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="responder-selector">
            <label>
              RESPONDER ACCOUNT
            </label>

            <select
              value={selectedResponderId}
              onChange={(event) => {
                setSelectedResponderId(
                  event.target.value
                );

                setError("");
                setSuccess("");
              }}
            >
              <option value="">
                Select organization
              </option>

              {responders.map((responder) => (
                <option
                  key={responder.responder_id}
                  value={responder.responder_id}
                >
                  {responder.name} —{" "}
                  {responder.availability}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* ==================================================
            QUICK STATS
        ================================================== */}

        <section className="responder-stats">
          <div className="responder-stat">
            <div className="responder-stat-icon">
              <Radio size={19} />
            </div>

            <div>
              <span>New requests</span>
              <strong>{stats.requests}</strong>
            </div>
          </div>

          <div className="responder-stat">
            <div className="responder-stat-icon">
              <Activity size={19} />
            </div>

            <div>
              <span>Active rescues</span>
              <strong>{stats.active}</strong>
            </div>
          </div>

          <div className="responder-stat">
            <div className="responder-stat-icon">
              <HeartPulse size={19} />
            </div>

            <div>
              <span>Animals rescued</span>
              <strong>{stats.rescued}</strong>
            </div>
          </div>

          <div className="responder-stat">
            <div className="responder-stat-icon">
              <CheckCircle2 size={19} />
            </div>

            <div>
              <span>Completed</span>
              <strong>{stats.completed}</strong>
            </div>
          </div>
        </section>

        {/* ==================================================
            INCOMING RESCUE REQUESTS
        ================================================== */}

        <section className="responder-section">
          <div className="responder-section-header">
            <div>
              <span className="section-label">
                INCOMING RESCUE REQUESTS
              </span>

              <h2>
                Cases waiting for a responder
              </h2>

              <p>
                New animal distress reports
                prioritized using PAWScore so urgent
                animals appear first.
              </p>
            </div>

            <span className="queue-count">
              {incomingCases.length} waiting
            </span>
          </div>

          {incomingCases.length === 0 ? (
            <div className="responder-empty">
              <CheckCircle2 size={30} />

              <h3>
                No new rescue requests
              </h3>

              <p>
                New animal distress reports will
                appear here when they need a responder.
              </p>
            </div>
          ) : (
            <div className="responder-case-list">
              {incomingCases.map((item) => {
                // ==================================================
                // IMPORTANT:
                // These variables are defined INSIDE map().
                // This fixes the distance/matchScore error.
                // ==================================================

                const distance =
                  getDistance(item);

                const matchScore =
                  getMatchScore(item);

                const imageUrl =
                  getImageUrl(item);

                const analysis =
                  getAnalysis(item);

                return (
                  <article
                    className="responder-case-card"
                    key={item.case_id}
                  >
                    <div className="case-card-main">

                      <div className="case-card-top">
                        <span
                          className={getPriorityClass(
                            getPriority(item)
                          )}
                        >
                          {getPriority(item)}
                        </span>

                        <span className="case-id">
                          {item.case_id}
                        </span>
                      </div>

                      <h3>
                        {item.species ||
                          "Unknown animal"}
                      </h3>

                      <div className="case-card-details">

                        <span>
                          <Activity size={14} />

                          PAWScore{" "}
                          <strong>
                            {Number(
                              getScore(item)
                            ).toFixed(0)}
                          </strong>
                          /100
                        </span>

                        <span>
                          <MapPin size={14} />

                          {item.location?.latitude !=
                            null &&
                          item.location?.longitude !=
                            null
                            ? `${Number(
                                item.location.latitude
                              ).toFixed(4)}, ${Number(
                                item.location.longitude
                              ).toFixed(4)}`
                            : "Location unavailable"}
                        </span>

                        {distance !== null && (
                          <span>
                            <Navigation size={14} />

                            {Number(
                              distance
                            ).toFixed(1)}{" "}
                            km away
                          </span>
                        )}

                        {matchScore !== null && (
                          <span>
                            <ShieldCheck
                              size={14}
                            />

                            Match{" "}
                            <strong>
                              {Number(
                                matchScore
                              ).toFixed(0)}
                              %
                            </strong>
                          </span>
                        )}
                      </div>

                      {item.reasons?.length > 0 && (
                        <div className="case-card-reasons">
                          {item.reasons
                            .slice(0, 3)
                            .map(
                              (reason, index) => (
                                <span
                                  key={index}
                                >
                                  {reason}
                                </span>
                              )
                            )}
                        </div>
                      )}

                      {/* ==================================================
                          AI ANALYSIS
                      ================================================== */}

                      {analysis && (
                        <div
                          className="ai-note"
                          style={{
                            marginTop: "12px",
                          }}
                        >
                          <Activity size={17} />

                          <span>
                            {typeof analysis ===
                            "string"
                              ? analysis
                              : analysis.summary ||
                                analysis.message ||
                                "AI analysis available for this case."}
                          </span>
                        </div>
                      )}

                      {/* ==================================================
                          IMAGE
                      ================================================== */}

                      {imageUrl && (
                        <div
                          style={{
                            marginTop: "12px",
                          }}
                        >
                          <img
                            src={imageUrl}
                            alt={`${
                              item.species ||
                              "Animal"
                            } report`}
                            style={{
                              width: "100%",
                              maxWidth: "260px",
                              maxHeight: "180px",
                              objectFit: "cover",
                              borderRadius: "12px",
                              display: "block",
                            }}
                            onError={(event) => {
                              event.currentTarget.style.display =
                                "none";
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="case-card-actions">
                      <button
                        className="secondary-case-action"
                        onClick={() =>
                          openCase(
                            item.case_id
                          )
                        }
                      >
                        View Case
                        <ChevronRight size={15} />
                      </button>

                      <button
                        className="primary-case-action"
                        onClick={() =>
                          claimCase(
                            item.case_id
                          )
                        }
                        disabled={
                          !currentResponder ||
                          currentResponder.availability !==
                            "AVAILABLE" ||
                          claimingCase ===
                            item.case_id
                        }
                      >
                        <ShieldCheck size={16} />

                        {claimingCase ===
                        item.case_id
                          ? "Accepting..."
                          : "Accept Rescue"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ==================================================
            ACTIVE RESCUES
        ================================================== */}

        <section className="responder-section">
          <div className="responder-section-header">
            <div>
              <span className="section-label">
                MY RESCUE OPERATIONS
              </span>

              <h2>
                Active rescue cases
              </h2>

              <p>
                Cases currently assigned to your
                responder organization.
              </p>
            </div>

            <span className="queue-count">
              {myActiveCases.length} active
            </span>
          </div>

          {myActiveCases.length === 0 ? (
            <div className="responder-empty compact">
              <Clock3 size={27} />

              <h3>
                No active rescue cases
              </h3>

              <p>
                Accepted rescue cases will appear
                here for tracking.
              </p>
            </div>
          ) : (
            <div className="responder-active-list">
              {myActiveCases.map((item) => {
                const imageUrl =
                  getImageUrl(item);

                return (
                  <article
                    className="active-case-card"
                    key={item.case_id}
                  >
                    <div>
                      <div className="active-case-heading">
                        <span
                          className={getPriorityClass(
                            getPriority(item)
                          )}
                        >
                          {getPriority(item)}
                        </span>

                        <span
                          className={getStatusClass(
                            item.status
                          )}
                        >
                          <span className="status-dot"></span>
                          {item.status}
                        </span>
                      </div>

                      <h3>
                        {item.species ||
                          "Unknown animal"}
                      </h3>

                      <div className="active-case-meta">
                        <span>
                          <Activity size={14} />

                          PAWScore{" "}
                          <strong>
                            {Number(
                              getScore(item)
                            ).toFixed(0)}
                          </strong>
                        </span>

                        <span>
                          <MapPin size={14} />

                          {item.location?.latitude !=
                            null &&
                          item.location?.longitude !=
                            null
                            ? `${Number(
                                item.location.latitude
                              ).toFixed(4)}, ${Number(
                                item.location.longitude
                              ).toFixed(4)}`
                            : "Location unavailable"}
                        </span>
                      </div>

                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt={`${
                            item.species ||
                            "Animal"
                          } report`}
                          style={{
                            marginTop: "12px",
                            width: "100%",
                            maxWidth: "220px",
                            height: "140px",
                            objectFit: "cover",
                            borderRadius: "12px",
                          }}
                          onError={(event) => {
                            event.currentTarget.style.display =
                              "none";
                          }}
                        />
                      )}
                    </div>

                    <div className="active-case-actions">
                      <button
                        className="secondary-case-action"
                        onClick={() =>
                          openCase(
                            item.case_id
                          )
                        }
                      >
                        View Case
                        <ChevronRight size={15} />
                      </button>

                      {item.status ===
                        "ASSIGNED" && (
                        <button
                          className="primary-case-action"
                          onClick={() =>
                            updateStatus(
                              item.case_id,
                              "RESCUED"
                            )
                          }
                          disabled={
                            updatingCase ===
                            item.case_id
                          }
                        >
                          <ShieldCheck size={16} />

                          {updatingCase ===
                          item.case_id
                            ? "Updating..."
                            : "Mark Rescued"}
                        </button>
                      )}

                      {item.status ===
                        "RESCUED" && (
                        <button
                          className="primary-case-action"
                          onClick={() =>
                            updateStatus(
                              item.case_id,
                              "RESOLVED"
                            )
                          }
                          disabled={
                            updatingCase ===
                            item.case_id
                          }
                        >
                          <CheckCircle2 size={16} />

                          {updatingCase ===
                          item.case_id
                            ? "Updating..."
                            : "Complete Rescue"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ==================================================
            COMPLETED RESCUES
        ================================================== */}

        <section className="responder-section">
          <div className="responder-section-header">
            <div>
              <span className="section-label">
                RESCUE HISTORY
              </span>

              <h2>
                Completed rescues
              </h2>

              <p>
                Recently resolved cases handled by
                your responder organization.
              </p>
            </div>

            <span className="queue-count">
              {myResolvedCases.length} completed
            </span>
          </div>

          {myResolvedCases.length === 0 ? (
            <div className="responder-empty compact">
              <ClipboardCheck size={27} />

              <h3>
                No completed rescues yet
              </h3>

              <p>
                Resolved rescue operations will
                appear here.
              </p>
            </div>
          ) : (
            <div className="responder-history-list">
              {myResolvedCases.map((item) => (
                <article
                  className="history-case-card"
                  key={item.case_id}
                >
                  <div className="history-case-icon">
                    <CheckCircle2 size={20} />
                  </div>

                  <div className="history-case-info">
                    <div>
                      <span
                        className={getPriorityClass(
                          getPriority(item)
                        )}
                      >
                        {getPriority(item)}
                      </span>

                      <span className="case-id">
                        {item.case_id}
                      </span>
                    </div>

                    <h3>
                      {item.species ||
                        "Unknown animal"}
                    </h3>

                    <p>
                      PAWScore{" "}
                      <strong>
                        {Number(
                          getScore(item)
                        ).toFixed(0)}
                      </strong>
                      {" • "}
                      Rescue completed
                    </p>
                  </div>

                  <button
                    className="secondary-case-action"
                    onClick={() =>
                      openCase(
                        item.case_id
                      )
                    }
                  >
                    View Case
                    <ChevronRight size={15} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ==================================================
            WORKFLOW
        ================================================== */}

        <section className="responder-workflow">
          <div className="responder-workflow-header">
            <span className="section-label">
              RESCUE WORKFLOW
            </span>

            <h2>
              From alert to resolution
            </h2>

            <p>
              Every rescue request moves through a
              clear responder workflow.
            </p>
          </div>

          <div className="workflow-grid">
            <div className="workflow-step">
              <div className="workflow-number">
                01
              </div>

              <Radio size={19} />

              <h3>Receive</h3>

              <p>
                New distress report reaches the
                responder network.
              </p>
            </div>

            <div className="workflow-arrow">
              →
            </div>

            <div className="workflow-step">
              <div className="workflow-number">
                02
              </div>

              <ShieldCheck size={19} />

              <h3>Accept</h3>

              <p>
                Responder claims the case based on
                availability.
              </p>
            </div>

            <div className="workflow-arrow">
              →
            </div>

            <div className="workflow-step">
              <div className="workflow-number">
                03
              </div>

              <HeartPulse size={19} />

              <h3>Rescue</h3>

              <p>
                Organization reaches the animal
                and performs rescue.
              </p>
            </div>

            <div className="workflow-arrow">
              →
            </div>

            <div className="workflow-step">
              <div className="workflow-number">
                04
              </div>

              <CheckCircle2 size={19} />

              <h3>Resolve</h3>

              <p>
                Final rescue outcome is recorded in
                the system.
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================
            GUIDANCE
        ================================================== */}

        <section className="responder-guidance">
          <ShieldCheck size={20} />

          <div>
            <strong>
              Responder guidance
            </strong>

            <p>
              PAWSignal provides AI-assisted welfare
              triage based on visible indicators.
              Responders and veterinary professionals
              make the final intervention decision.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ResponderDashboard;