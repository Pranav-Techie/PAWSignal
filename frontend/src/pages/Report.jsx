import { useRef, useState } from "react";
import {
  Camera,
  MapPin,
  Upload,
  X,
  ShieldCheck,
  ArrowRight,
  Info,
  AlertTriangle,
  CheckCircle2,
  Activity,
  RotateCcw,
} from "lucide-react";
import Navbar from "../components/Navbar";

function Report() {
  const fileInputRef = useRef(null);

  const [image, setImage] = useState(null);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFile = (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

    if (image?.preview) {
      URL.revokeObjectURL(image.preview);
    }

    const imageUrl = URL.createObjectURL(file);

    setImage({
      file,
      preview: imageUrl,
      name: file.name,
    });

    setResult(null);
    setError("");
  };

  const handleFileInput = (event) => {
    const file = event.target.files?.[0];
    handleFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    handleFile(file);
  };

  const removeImage = () => {
    if (image?.preview) {
      URL.revokeObjectURL(image.preview);
    }

    setImage(null);
    setResult(null);
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      alert("Location is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setLocation(
          `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        );
      },
      () => {
        alert(
          "Unable to access your location. Please enter it manually."
        );
      }
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!image) {
      alert("Please upload an animal photo first.");
      return;
    }

    if (!location.trim()) {
      alert("Please provide the animal's location.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const locationParts = location.split(",");

      const latitude = locationParts[0]?.trim() || "";
      const longitude = locationParts[1]?.trim() || "";

      const formData = new FormData();

      formData.append("image", image.file);
      formData.append("description", description);
      formData.append("latitude", latitude);
      formData.append("longitude", longitude);

      const response = await fetch(
  `${API_URL}/analyze`,
  {
    method: "POST",
    body: formData,
  }
);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "PAWSignal analysis failed. Please try again."
        );
      }

      setResult(data);
    } catch (err) {
      console.error("PAWSignal analysis error:", err);

      setError(
        err.message ||
          "Unable to connect to PAWSignal AI. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetAnalysis = () => {
    setResult(null);
    setError("");
  };

  return (
    <div className="app">
      <Navbar />

      <main className="report-page">
        <div className="report-header">
          <div>
            <span className="eyebrow">
              <span className="pulse-dot"></span>
              NEW RESCUE REPORT
            </span>

            <h1>Report an animal in distress</h1>

            <p>
              Help us understand what is happening. Upload a clear photo
              and provide the animal's location so PAWSignal can assess
              the case.
            </p>
          </div>

          <div className="privacy-note">
            <ShieldCheck size={18} />

            <span>
              Your report helps responders prioritize animals that need
              help most urgently.
            </span>
          </div>
        </div>

        {!result ? (
          <form className="report-layout" onSubmit={handleSubmit}>
            <section className="report-main-card">
              <div className="form-section">
                <div className="form-section-heading">
                  <div className="step-number">01</div>

                  <div>
                    <h2>Animal photo</h2>

                    <p>
                      A clear image helps PAWSignal identify visible
                      welfare indicators.
                    </p>
                  </div>
                </div>

                {!image ? (
                  <div
                    className={`upload-zone ${
                      dragActive ? "drag-active" : ""
                    }`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="upload-icon">
                      <Camera size={26} />
                    </div>

                    <h3>Upload an animal photo</h3>

                    <p>
                      Drag and drop an image here, or click to browse
                    </p>

                    <span className="upload-format">
                      JPG, PNG or WEBP
                    </span>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileInput}
                      hidden
                    />
                  </div>
                ) : (
                  <div className="image-preview">
                    <img
                      src={image.preview}
                      alt="Animal preview"
                    />

                    <button
                      type="button"
                      className="remove-image"
                      onClick={removeImage}
                      aria-label="Remove image"
                    >
                      <X size={18} />
                    </button>

                    <div className="image-info">
                      <div>
                        <strong>{image.name}</strong>

                        <span>
                          Ready for PAWSignal analysis
                        </span>
                      </div>

                      <div className="image-ready">
                        <ShieldCheck size={16} />
                        Ready
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-divider"></div>

              <div className="form-section">
                <div className="form-section-heading">
                  <div className="step-number">02</div>

                  <div>
                    <h2>Animal location</h2>

                    <p>
                      Location allows responders to find the animal
                      quickly.
                    </p>
                  </div>
                </div>

                <div className="location-input">
                  <MapPin size={20} />

                  <input
                    type="text"
                    placeholder="Enter a location, landmark or coordinates"
                    value={location}
                    onChange={(event) =>
                      setLocation(event.target.value)
                    }
                  />

                  <button
                    type="button"
                    className="location-button"
                    onClick={getLocation}
                  >
                    Use my location
                  </button>
                </div>
              </div>

              <div className="form-divider"></div>

              <div className="form-section">
                <div className="form-section-heading">
                  <div className="step-number">03</div>

                  <div>
                    <h2>What did you observe?</h2>

                    <p>
                      Tell responders anything you noticed about the
                      animal.
                    </p>
                  </div>
                </div>

                <textarea
                  className="description-input"
                  placeholder="Example: The dog is lying near the road and appears unable to stand. I noticed a possible injury to its back leg."
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  rows={6}
                  maxLength={500}
                />

                <div className="character-count">
                  {description.length}/500
                </div>
              </div>
            </section>

            <aside className="report-side-card">
              <div className="side-icon">
                <Upload size={20} />
              </div>

              <h3>
                {loading
                  ? "Analyzing animal..."
                  : "Ready to analyze?"}
              </h3>

              <p>
                PAWSignal will use AI-assisted visual analysis to
                identify visible welfare indicators and estimate case
                urgency.
              </p>

              <div className="side-checks">
                <div>
                  <ShieldCheck size={16} />
                  <span>Visible condition assessment</span>
                </div>

                <div>
                  <ShieldCheck size={16} />
                  <span>Welfare urgency score</span>
                </div>

                <div>
                  <ShieldCheck size={16} />
                  <span>Priority recommendation</span>
                </div>
              </div>

              <div className="side-warning">
                <Info size={16} />

                <span>
                  PAWSignal provides an AI-assisted assessment, not a
                  veterinary diagnosis.
                </span>
              </div>

              {error && (
                <div className="analysis-error">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="analyze-button"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Analyzing...
                  </>
                ) : (
                  <>
                    Analyze with PAWSignal AI
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </aside>
          </form>
        ) : (
          <section className="analysis-result-page">
            <div className="result-top">
              <div>
                <span className="eyebrow">
                  <span className="pulse-dot"></span>
                  AI ANALYSIS COMPLETE
                </span>

                <h2>PAWSignal assessment</h2>

                <p>
                  Case {result.case_id} has been analyzed using visible
                  welfare indicators.
                </p>
              </div>

              <button
                type="button"
                className="new-analysis-button"
                onClick={resetAnalysis}
              >
                <RotateCcw size={16} />
                Analyze another case
              </button>
            </div>

            <div className="result-grid">
              <div className="score-card">
                <div className="score-card-top">
                  <span>PAWSCORE</span>
                  <Activity size={19} />
                </div>

                <div className="score-number">
                  {result.score.total}
                  <span>/100</span>
                </div>

                <div
                  className={`priority-badge priority-${result.score.priority.toLowerCase()}`}
                >
                  {result.score.priority}
                </div>

                <p>{result.recommendation}</p>
              </div>

              <div className="analysis-card">
                <div className="analysis-card-heading">
                  <CheckCircle2 size={19} />

                  <div>
                    <h3>AI observations</h3>

                    <span>
                      Confidence:{" "}
                      {Math.round(
                        (result.analysis.confidence || 0) * 100
                      )}
                      %
                    </span>
                  </div>
                </div>

                <div className="observation-specs">
                  <div>
                    <span>Species</span>
                    <strong>
                      {result.analysis.species || "Unknown"}
                    </strong>
                  </div>

                  <div>
                    <span>Visible injury</span>
                    <strong>
                      {result.analysis.visible_injury
                        ? "Detected"
                        : "Not detected"}
                    </strong>
                  </div>

                  <div>
                    <span>Injury severity</span>
                    <strong>
                      {result.analysis.injury_severity}/5
                    </strong>
                  </div>

                  <div>
                    <span>Mobility impairment</span>
                    <strong>
                      {result.analysis.mobility_impairment}/5
                    </strong>
                  </div>

                  <div>
                    <span>Bleeding indicator</span>
                    <strong>
                      {result.analysis.bleeding}/5
                    </strong>
                  </div>

                  <div>
                    <span>Environmental danger</span>
                    <strong>
                      {result.analysis.environmental_danger}/5
                    </strong>
                  </div>

                  <div>
                    <span>Vulnerability</span>
                    <strong>
                      {result.analysis.vulnerability}/5
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="result-bottom-grid">
              <div className="reasons-card">
                <h3>Why is this case urgent?</h3>

                <p>
                  PAWSignal generated the priority from the observed
                  welfare indicators.
                </p>

                <div className="reason-list">
                  {result.score.reasons?.map((reason, index) => (
                    <div key={index}>
                      <span>{index + 1}</span>
                      <p>{reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="observations-card">
                <h3>What the AI observed</h3>

                <div className="observation-list">
                  {result.analysis.observations?.map(
                    (observation, index) => (
                      <div key={index}>
                        <CheckCircle2 size={15} />
                        <span>{observation}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="result-disclaimer">
              <Info size={16} />

              <span>
                This is an AI-assisted welfare assessment based on
                visible indicators. It is not a veterinary diagnosis.
              </span>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default Report;