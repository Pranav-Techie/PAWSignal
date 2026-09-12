import os
import json
import base64
import uuid
import math

from datetime import datetime

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Depends,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from openai import OpenAI
from sqlalchemy.orm import Session

from database import (
    get_db,
    Case,
    Responder,
    SessionLocal,
)


# ==================================================
# ENVIRONMENT
# ==================================================

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY is missing. "
        "Please add it to backend/.env"
    )

client = OpenAI(api_key=OPENAI_API_KEY)


# ==================================================
# FASTAPI
# ==================================================

app = FastAPI(
    title="PAWSignal API",
    description=(
        "AI-assisted animal welfare triage "
        "and rescue intelligence API"
    ),
    version="3.1.0",
)


# ==================================================
# CORS
# ==================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://pawsignal-puce.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================
# UPLOADS
# ==================================================

UPLOADS_DIRECTORY = "uploads"

os.makedirs(
    UPLOADS_DIRECTORY,
    exist_ok=True,
)

app.mount(
    "/uploads",
    StaticFiles(
        directory=UPLOADS_DIRECTORY
    ),
    name="uploads",
)


# ==================================================
# HELPERS
# ==================================================

def utc_now():
    return datetime.utcnow()


def safe_json_loads(value, fallback):
    try:
        return json.loads(
            value or json.dumps(fallback)
        )
    except (
        TypeError,
        json.JSONDecodeError,
    ):
        return fallback


def clamp_score(value, minimum=0, maximum=5):
    """
    Safely convert AI severity values to
    the expected 0-5 range.
    """
    try:
        value = int(float(value))
    except (
        TypeError,
        ValueError,
    ):
        value = 0

    return max(
        minimum,
        min(maximum, value),
    )


def clamp_confidence(value):
    """
    Keep AI confidence between 0 and 1.
    """
    try:
        value = float(value)
    except (
        TypeError,
        ValueError,
    ):
        value = 0.0

    return max(
        0.0,
        min(1.0, value),
    )


def responder_dict(responder):
    if not responder:
        return None

    return {
        "responder_id": responder.responder_id,
        "name": responder.name,
        "responder_type": responder.responder_type,
        "specialization": responder.specialization,
        "location": {
            "latitude": responder.latitude,
            "longitude": responder.longitude,
        },
        "service_radius_km": responder.service_radius_km,
        "availability": responder.availability,
        "verified": bool(responder.verified),
        "active_cases": responder.active_cases or 0,
        "total_cases": responder.total_cases or 0,
    }


def assigned_responder_for_case(case, db):
    if not case.assigned_responder_id:
        return None

    return (
        db.query(Responder)
        .filter(
            Responder.responder_id
            == case.assigned_responder_id
        )
        .first()
    )


def case_dict(case, db):
    responder = assigned_responder_for_case(
        case,
        db,
    )

    image_url = None

    if case.image_filename:
        image_url = (
            f"/uploads/{case.image_filename}"
        )

    return {
        "case_id": case.case_id,

        # Report creation timestamp is used by the Home/Analytics
        # page to calculate the real report -> assignment response time.
        "created_at": getattr(case, "created_at", None),

        "location": {
            "latitude": case.latitude,
            "longitude": case.longitude,
        },

        "species": case.species,

        "score": case.score,

        "priority": case.priority,

        "status": case.status,

        "confidence": case.confidence,

        "visible_injury": bool(
            case.visible_injury
        ),

        "injury_severity": case.injury_severity,

        "mobility_impairment":
            case.mobility_impairment,

        "bleeding": case.bleeding,

        "environmental_danger":
            case.environmental_danger,

        "vulnerability":
            case.vulnerability,

        "description":
            case.description,

        "recommendation":
            case.recommendation,

        "image_filename":
            case.image_filename,

        "image_url":
            image_url,

        "assigned_responder":
            (
                responder_dict(responder)
                if responder
                else None
            ),

        "assigned_at":
            case.assigned_at,

        # Actual response duration in minutes. None means the case
        # has not yet been assigned or the report timestamp is unavailable.
        "response_time_minutes": (
            round(
                (case.assigned_at - getattr(case, "created_at", None)).total_seconds() / 60,
                2,
            )
            if case.assigned_at is not None
            and getattr(case, "created_at", None) is not None
            and (case.assigned_at - getattr(case, "created_at", None)).total_seconds() >= 0
            else None
        ),

        "rescued_at":
            case.rescued_at,

        "resolved_at":
            case.resolved_at,

        "observations":
            safe_json_loads(
                case.observations,
                [],
            ),

        "reasons":
            safe_json_loads(
                case.reasons,
                [],
            ),
    }


# ==================================================
# ROOT
# ==================================================

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "PAWSignal API",
        "version": "3.1.0",
        "message": (
            "Animal welfare intelligence "
            "and rescue coordination backend "
            "is running."
        ),
    }


# ==================================================
# HEALTH
# ==================================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "ai": "connected",
        "database": "connected",
        "dispatch": "active",
        "responder_dashboard": "active",
    }


# ==================================================
# PAWSCORE ENGINE
# ==================================================

def calculate_pawscore(analysis):

    injury = clamp_score(
        analysis.get(
            "injury_severity",
            0,
        )
    )

    mobility = clamp_score(
        analysis.get(
            "mobility_impairment",
            0,
        )
    )

    bleeding = clamp_score(
        analysis.get(
            "bleeding",
            0,
        )
    )

    environment = clamp_score(
        analysis.get(
            "environmental_danger",
            0,
        )
    )

    vulnerability = clamp_score(
        analysis.get(
            "vulnerability",
            0,
        )
    )

    injury_points = round(
        (injury / 5) * 30
    )

    mobility_points = round(
        (mobility / 5) * 25
    )

    bleeding_points = round(
        (bleeding / 5) * 20
    )

    environment_points = round(
        (environment / 5) * 15
    )

    vulnerability_points = round(
        (vulnerability / 5) * 10
    )

    total = (
        injury_points
        + mobility_points
        + bleeding_points
        + environment_points
        + vulnerability_points
    )

    if total >= 80:
        priority = "CRITICAL"

    elif total >= 60:
        priority = "HIGH"

    elif total >= 35:
        priority = "MODERATE"

    else:
        priority = "LOW"

    reasons = []

    if injury >= 4:
        reasons.append(
            "Significant visible injury indicators"
        )

    elif injury >= 2:
        reasons.append(
            "Possible visible injury"
        )

    if mobility >= 4:
        reasons.append(
            "Severe mobility impairment"
        )

    elif mobility >= 2:
        reasons.append(
            "Reduced mobility"
        )

    if bleeding >= 4:
        reasons.append(
            "Significant visible bleeding"
        )

    elif bleeding >= 2:
        reasons.append(
            "Possible visible bleeding"
        )

    if environment >= 4:
        reasons.append(
            "High environmental danger"
        )

    elif environment >= 2:
        reasons.append(
            "Potential environmental danger"
        )

    if vulnerability >= 4:
        reasons.append(
            "High vulnerability"
        )

    elif vulnerability >= 2:
        reasons.append(
            "Animal may be vulnerable"
        )

    if not reasons:
        reasons.append(
            "No major visible distress "
            "indicators detected"
        )

    return {
        "total": total,

        "priority": priority,

        "breakdown": {
            "injury": injury_points,
            "mobility": mobility_points,
            "bleeding": bleeding_points,
            "environment": environment_points,
            "vulnerability": vulnerability_points,
        },

        "reasons": reasons,
    }


# ==================================================
# DISTANCE CALCULATION
# ==================================================

def calculate_distance_km(
    lat1,
    lon1,
    lat2,
    lon2,
):

    if (
        lat1 is None
        or lon1 is None
        or lat2 is None
        or lon2 is None
        or lat1 == ""
        or lon1 == ""
        or lat2 == ""
        or lon2 == ""
    ):
        return None

    try:
        lat1 = float(lat1)
        lon1 = float(lon1)
        lat2 = float(lat2)
        lon2 = float(lon2)

    except (
        TypeError,
        ValueError,
    ):
        return None

    earth_radius_km = 6371.0

    dlat = math.radians(
        lat2 - lat1
    )

    dlon = math.radians(
        lon2 - lon1
    )

    a = (
        math.sin(dlat / 2) ** 2
        +
        math.cos(
            math.radians(lat1)
        )
        *
        math.cos(
            math.radians(lat2)
        )
        *
        math.sin(dlon / 2) ** 2
    )

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a),
    )

    return round(
        earth_radius_km * c,
        2,
    )


# ==================================================
# SPECIES MATCHING
# ==================================================

def check_species_match(
    species,
    specialization,
):

    species = (
        species or "unknown"
    ).lower().strip()

    specialization = (
        specialization or ""
    ).lower().strip()

    if (
        not species
        or species == "unknown"
    ):
        return (
            "animal rescue" in specialization
            or "general" in specialization
            or "wildlife" in specialization
        )

    if species in specialization:
        return True

    if species == "dog":
        return any(
            term in specialization
            for term in [
                "dog",
                "animal rescue",
                "general",
                "veterinary",
                "emergency veterinary",
            ]
        )

    if species == "cat":
        return any(
            term in specialization
            for term in [
                "cat",
                "animal rescue",
                "general",
                "veterinary",
                "emergency veterinary",
            ]
        )

    bird_species = [
        "bird",
        "pigeon",
        "crow",
        "sparrow",
        "parrot",
        "eagle",
        "owl",
        "peacock",
        "duck",
        "hen",
    ]

    if any(
        bird in species
        for bird in bird_species
    ):
        return any(
            term in specialization
            for term in [
                "bird",
                "wildlife",
                "animal rescue",
                "veterinary",
            ]
        )

    wildlife_keywords = [
        "snake",
        "deer",
        "monkey",
        "wildlife",
        "reptile",
    ]

    if any(
        keyword in species
        for keyword in wildlife_keywords
    ):
        return any(
            term in specialization
            for term in [
                "wildlife",
                "animal rescue",
                "veterinary",
            ]
        )

    return (
        "animal rescue" in specialization
        or "general" in specialization
        or "veterinary" in specialization
    )


# ==================================================
# RESPONDER MATCH SCORE
# ==================================================

def calculate_match_score(
    case,
    responder,
    distance,
    species_match,
    within_radius,
):

    score = 0

    if species_match:
        score += 50

    if within_radius:
        score += 25

    if distance is not None:

        if distance <= 1:
            score += 20

        elif distance <= 3:
            score += 17

        elif distance <= 5:
            score += 14

        elif distance <= 10:
            score += 10

    active_cases = (
        responder.active_cases or 0
    )

    if active_cases == 0:
        score += 5

    elif active_cases == 1:
        score += 3

    return min(
        round(score, 2),
        100,
    )


# ==================================================
# FIND RESPONDER MATCHES
# ==================================================

def get_responder_matches(
    case,
    db,
):

    if (
        case.latitude is None
        or case.longitude is None
        or case.latitude == ""
        or case.longitude == ""
    ):
        return []

    try:
        case_latitude = float(
            case.latitude
        )

        case_longitude = float(
            case.longitude
        )

    except (
        TypeError,
        ValueError,
    ):
        return []

    responders = (
        db.query(Responder)
        .filter(
            Responder.availability
            == "AVAILABLE",

            Responder.verified
            == 1,
        )
        .all()
    )

    matches = []

    for responder in responders:

        distance = calculate_distance_km(
            case_latitude,
            case_longitude,
            responder.latitude,
            responder.longitude,
        )

        if distance is None:
            continue

        species_match = check_species_match(
            case.species,
            responder.specialization,
        )

        within_radius = (
            distance
            <= (
                responder.service_radius_km
                or 10
            )
        )

        if not within_radius:
            continue

        if not species_match:
            continue

        match_score = calculate_match_score(
            case,
            responder,
            distance,
            species_match,
            within_radius,
        )

        matches.append({

            "responder_id":
                responder.responder_id,

            "name":
                responder.name,

            "responder_type":
                responder.responder_type,

            "specialization":
                responder.specialization,

            "distance_km":
                distance,

            "service_radius_km":
                responder.service_radius_km,

            "availability":
                responder.availability,

            "verified":
                bool(
                    responder.verified
                ),

            "active_cases":
                responder.active_cases or 0,

            "total_cases":
                responder.total_cases or 0,

            "species_match":
                species_match,

            "within_service_radius":
                within_radius,

            "match_score":
                match_score,

            "match_quality":
                (
                    "EXCELLENT"
                    if match_score >= 80
                    else
                    "GOOD"
                    if match_score >= 60
                    else
                    "FAIR"
                ),
        })

    matches.sort(
        key=lambda item: (
            item["match_score"],
            -item["active_cases"],
            -item["distance_km"],
        ),
        reverse=True,
    )

    return matches


# ==================================================
# AI ANALYSIS
# ==================================================

@app.post("/analyze")
async def analyze_animal(

    image: UploadFile = File(...),

    description: str = Form(""),

    latitude: str = Form(""),

    longitude: str = Form(""),

    db: Session = Depends(get_db),
):

    if (
        not image.content_type
        or not image.content_type.startswith(
            "image/"
        )
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload a valid image file."
            ),
        )

    image_bytes = await image.read()

    if not image_bytes:

        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty.",
        )

    # Prevent excessively large uploads.
    max_image_size = 10 * 1024 * 1024

    if len(image_bytes) > max_image_size:

        raise HTTPException(
            status_code=413,
            detail=(
                "Image is too large. "
                "Maximum allowed size is 10 MB."
            ),
        )

    encoded_image = base64.b64encode(
        image_bytes
    ).decode("utf-8")

    image_url = (
        f"data:{image.content_type};"
        f"base64,{encoded_image}"
    )

    prompt = f"""
You are PAWSignal, an AI-assisted
animal welfare triage system.

Analyze the uploaded image carefully.

Your job is NOT to provide a veterinary diagnosis.

Only identify visible or reasonably
observable welfare indicators.

Consider:

1. Animal species
2. Visible injury
3. Injury severity
4. Mobility impairment
5. Visible bleeding
6. Environmental danger
7. Vulnerability
8. Visible observations

Use numeric severity values from 0 to 5.

0 = none / not observed
1 = very mild
2 = mild
3 = moderate
4 = severe
5 = extreme

Important:

- Do not invent injuries.
- Do not diagnose diseases.
- If something is unclear, use lower confidence.
- Focus on visible welfare indicators.
- Environmental danger includes roads,
  traffic, water hazards, fire,
  construction, entanglement,
  or similar hazards.

Reporter description:

"{description}"

Return ONLY valid JSON.

Use exactly:

{{
    "species": "dog",
    "visible_injury": true,
    "injury_type": "possible limb injury",
    "injury_severity": 0,
    "mobility_impairment": 0,
    "bleeding": 0,
    "environmental_danger": 0,
    "vulnerability": 0,
    "confidence": 0.0,
    "observations": [
        "observation 1",
        "observation 2"
    ]
}}
"""

    try:

        response = client.responses.create(

            model="gpt-5.6-luna",

            input=[

                {
                    "role": "user",

                    "content": [

                        {
                            "type": "input_text",
                            "text": prompt,
                        },

                        {
                            "type": "input_image",
                            "image_url": image_url,
                        },
                    ],
                }
            ],
        )

    except Exception as e:

        print(
            "OpenAI error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "AI analysis failed. "
                "Please try again."
            ),
        )

    ai_text = (
        response.output_text
        .strip()
    )

    # Remove accidental markdown fences.
    if ai_text.startswith("```"):

        ai_text = (
            ai_text
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )

    try:

        analysis = json.loads(
            ai_text
        )

    except json.JSONDecodeError:

        print("Invalid AI JSON:")
        print(ai_text)

        raise HTTPException(
            status_code=500,
            detail=(
                "AI returned an invalid "
                "analysis format."
            ),
        )

    # Normalize AI values before scoring.
    analysis["injury_severity"] = clamp_score(
        analysis.get(
            "injury_severity",
            0,
        )
    )

    analysis["mobility_impairment"] = clamp_score(
        analysis.get(
            "mobility_impairment",
            0,
        )
    )

    analysis["bleeding"] = clamp_score(
        analysis.get(
            "bleeding",
            0,
        )
    )

    analysis["environmental_danger"] = clamp_score(
        analysis.get(
            "environmental_danger",
            0,
        )
    )

    analysis["vulnerability"] = clamp_score(
        analysis.get(
            "vulnerability",
            0,
        )
    )

    analysis["confidence"] = clamp_confidence(
        analysis.get(
            "confidence",
            0,
        )
    )

    analysis["visible_injury"] = bool(
        analysis.get(
            "visible_injury",
            False,
        )
    )

    if not isinstance(
        analysis.get("observations"),
        list,
    ):
        analysis["observations"] = []

    score = calculate_pawscore(
        analysis
    )

    case_id = (
        f"PS-{str(uuid.uuid4())[:8].upper()}"
    )

    if score["priority"] == "CRITICAL":

        recommendation = (
            "Immediate rescue or veterinary "
            "assessment is recommended."
        )

    elif score["priority"] == "HIGH":

        recommendation = (
            "Rapid responder assessment "
            "is recommended."
        )

    elif score["priority"] == "MODERATE":

        recommendation = (
            "Responder follow-up "
            "should be arranged."
        )

    else:

        recommendation = (
            "Monitor the animal and consider "
            "welfare follow-up."
        )

    # Preserve original image extension.
    extension = ".jpg"

    if image.content_type == "image/png":
        extension = ".png"

    elif image.content_type == "image/webp":
        extension = ".webp"

    elif image.content_type == "image/gif":
        extension = ".gif"

    elif image.content_type == "image/jpeg":
        extension = ".jpg"

    image_filename = (
        f"{case_id}{extension}"
    )

    image_path = os.path.join(
        UPLOADS_DIRECTORY,
        image_filename,
    )

    with open(
        image_path,
        "wb",
    ) as image_file:

        image_file.write(
            image_bytes
        )

    saved_case = Case(

        case_id=case_id,

        latitude=latitude,

        longitude=longitude,

        description=description,

        image_filename=image_filename,

        species=analysis.get(
            "species",
            "Unknown",
        ),

        visible_injury=(
            1
            if analysis.get(
                "visible_injury"
            )
            else 0
        ),

        injury_severity=
            analysis["injury_severity"],

        mobility_impairment=
            analysis["mobility_impairment"],

        bleeding=
            analysis["bleeding"],

        environmental_danger=
            analysis["environmental_danger"],

        vulnerability=
            analysis["vulnerability"],

        confidence=
            analysis["confidence"],

        score=score["total"],

        priority=score["priority"],

        recommendation=recommendation,

        status="NEW",

        observations=json.dumps(
            analysis.get(
                "observations",
                [],
            )
        ),

        reasons=json.dumps(
            score["reasons"]
        ),
    )

    db.add(saved_case)

    db.commit()

    db.refresh(saved_case)

    return {

        "case_id":
            case_id,

        "location": {

            "latitude":
                latitude,

            "longitude":
                longitude,
        },

        "analysis":
            analysis,

        "score":
            score,

        "recommendation":
            recommendation,

        "status":
            "NEW",

        "disclaimer": (
            "PAWSignal provides an AI-assisted "
            "welfare assessment and does not "
            "provide a veterinary diagnosis."
        ),
    }


# ==================================================
# GET ALL CASES
# ==================================================

@app.get("/cases")
def get_cases(
    db: Session = Depends(get_db),
):

    cases = (
        db.query(Case)
        .order_by(
            Case.id.desc()
        )
        .all()
    )

    results = [
        case_dict(case, db)
        for case in cases
    ]

    return {
        "count": len(results),
        "cases": results,
    }


# ==================================================
# GET SINGLE CASE
# ==================================================

@app.get("/cases/{case_id}")
def get_case(

    case_id: str,

    db: Session = Depends(get_db),
):

    case = (
        db.query(Case)
        .filter(
            Case.case_id == case_id
        )
        .first()
    )

    if not case:

        raise HTTPException(
            status_code=404,
            detail="Case not found.",
        )

    return case_dict(
        case,
        db,
    )


# ==================================================
# GET RESPONDERS
# ==================================================

@app.get("/responders")
def get_responders(

    db: Session = Depends(get_db),
):

    responders = (
        db.query(Responder)
        .order_by(
            Responder.id.asc()
        )
        .all()
    )

    results = [
        responder_dict(responder)
        for responder in responders
    ]

    return {

        "count":
            len(results),

        "responders":
            results,
    }


# ==================================================
# GET SINGLE RESPONDER
# ==================================================

@app.get("/responders/{responder_id}")
def get_responder(

    responder_id: str,

    db: Session = Depends(get_db),

):

    responder = (
        db.query(Responder)
        .filter(
            Responder.responder_id
            == responder_id
        )
        .first()
    )

    if not responder:

        raise HTTPException(
            status_code=404,
            detail="Responder not found.",
        )

    return responder_dict(
        responder
    )


# ==================================================
# ADD RESPONDER
# ==================================================

@app.post("/responders")
def add_responder(

    name: str,

    responder_type: str,

    specialization: str = "",

    latitude: float = 0,

    longitude: float = 0,

    service_radius_km: float = 10,

    availability: str = "AVAILABLE",

    db: Session = Depends(get_db),
):

    availability = (
        availability
        .upper()
        .strip()
    )

    allowed = {
        "AVAILABLE",
        "BUSY",
        "OFFLINE",
    }

    if availability not in allowed:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid availability. "
                "Use AVAILABLE, BUSY or OFFLINE."
            ),
        )

    if service_radius_km <= 0:

        raise HTTPException(
            status_code=400,
            detail=(
                "Service radius must be "
                "greater than 0."
            ),
        )

    responder_id = (
        f"R-{str(uuid.uuid4())[:8].upper()}"
    )

    responder = Responder(

        responder_id=responder_id,

        name=name,

        responder_type=responder_type,

        specialization=specialization,

        latitude=latitude,

        longitude=longitude,

        service_radius_km=service_radius_km,

        availability=availability,

        verified=1,

        active_cases=0,

        total_cases=0,
    )

    db.add(responder)

    db.commit()

    db.refresh(responder)

    return {

        "success": True,

        "responder":
            responder_dict(
                responder
            ),
    }


# ==================================================
# RESPONDER DASHBOARD
# ==================================================

@app.get(
    "/responders/{responder_id}/dashboard"
)
def responder_dashboard(

    responder_id: str,

    db: Session = Depends(get_db),
):

    responder = (
        db.query(Responder)
        .filter(
            Responder.responder_id
            == responder_id
        )
        .first()
    )

    if not responder:

        raise HTTPException(
            status_code=404,
            detail="Responder not found.",
        )

    assigned_cases = (
        db.query(Case)
        .filter(
            Case.assigned_responder_id
            == responder.responder_id,

            Case.status.in_(
                [
                    "ASSIGNED",
                    "RESCUED",
                ]
            ),
        )
        .order_by(
            Case.id.desc()
        )
        .all()
    )

    available_cases = []

    new_cases = (
        db.query(Case)
        .filter(
            Case.status == "NEW"
        )
        .order_by(
            Case.id.desc()
        )
        .all()
    )

    for case in new_cases:

        matches = get_responder_matches(
            case,
            db,
        )

        own_match = next(
            (
                match
                for match in matches
                if match["responder_id"]
                == responder.responder_id
            ),
            None,
        )

        if own_match:

            available_cases.append({

                "case":
                    case_dict(
                        case,
                        db,
                    ),

                "match":
                    own_match,
            })

    return {

        "responder":
            responder_dict(
                responder
            ),

        "summary": {

            "active_cases":
                responder.active_cases or 0,

            "total_cases":
                responder.total_cases or 0,

            "assigned_cases":
                len(assigned_cases),

            "available_nearby_cases":
                len(available_cases),
        },

        "assigned_cases": [
            case_dict(
                case,
                db,
            )
            for case in assigned_cases
        ],

        "available_cases":
            available_cases,
    }


# ==================================================
# RESPONDER'S CASES
# ==================================================

@app.get(
    "/responders/{responder_id}/cases"
)
def responder_cases(

    responder_id: str,

    db: Session = Depends(get_db),
):

    responder = (
        db.query(Responder)
        .filter(
            Responder.responder_id
            == responder_id
        )
        .first()
    )

    if not responder:

        raise HTTPException(
            status_code=404,
            detail="Responder not found.",
        )

    cases = (
        db.query(Case)
        .filter(
            Case.assigned_responder_id
            == responder.responder_id
        )
        .order_by(
            Case.id.desc()
        )
        .all()
    )

    return {

        "responder_id":
            responder.responder_id,

        "count":
            len(cases),

        "cases": [
            case_dict(
                case,
                db,
            )
            for case in cases
        ],
    }


# ==================================================
# MATCH RESPONDER
# ==================================================

@app.get(
    "/cases/{case_id}/match"
)
def match_responder(

    case_id: str,

    db: Session = Depends(get_db),
):

    case = (
        db.query(Case)
        .filter(
            Case.case_id == case_id
        )
        .first()
    )

    if not case:

        raise HTTPException(
            status_code=404,
            detail="Case not found.",
        )

    if case.assigned_responder_id:

        assigned = (
            assigned_responder_for_case(
                case,
                db,
            )
        )

        return {

            "case_id":
                case.case_id,

            "animal":
                case.species,

            "priority":
                case.priority,

            "pawscore":
                case.score,

            "match_found":
                bool(assigned),

            "already_assigned":
                True,

            "recommended_responder":
                (
                    responder_dict(
                        assigned
                    )
                    if assigned
                    else None
                ),

            "alternative_responders":
                [],

            "available_responders":
                [],

            "matching_logic": [
                "Verified responder",
                "Responder availability",
                "Species compatibility",
                "Service radius",
                "Distance",
                "Current workload",
            ],
        }

    matches = get_responder_matches(
        case,
        db,
    )

    if not matches:

        return {

            "case_id":
                case.case_id,

            "animal":
                case.species,

            "priority":
                case.priority,

            "pawscore":
                case.score,

            "match_found":
                False,

            "already_assigned":
                False,

            "message": (
                "No verified available "
                "responder is currently "
                "within service range."
            ),
        }

    best_match = matches[0]

    return {

        "case_id":
            case.case_id,

        "animal":
            case.species,

        "priority":
            case.priority,

        "pawscore":
            case.score,

        "match_found":
            True,

        "already_assigned":
            False,

        "recommended_responder":
            best_match,

        "alternative_responders":
            matches[1:],

        # Every eligible responder is returned so the reporter can
        # choose another suitable responder instead of being forced
        # to accept the AI recommendation.
        "available_responders":
            matches,

        "matching_logic": [
            "Verified responder",
            "Responder availability",
            "Species compatibility",
            "Service radius",
            "Distance",
            "Current workload",
        ],
    }


# ==================================================
# AUTOMATIC ASSIGNMENT
# ==================================================

@app.post(
    "/cases/{case_id}/auto-assign"
)
def auto_assign_responder(

    case_id: str,

    db: Session = Depends(get_db),
):

    case = (
        db.query(Case)
        .filter(
            Case.case_id == case_id
        )
        .first()
    )

    if not case:

        raise HTTPException(
            status_code=404,
            detail="Case not found.",
        )

    if case.assigned_responder_id:

        responder = (
            assigned_responder_for_case(
                case,
                db,
            )
        )

        return {

            "success":
                True,

            "assigned":
                True,

            "already_assigned":
                True,

            "case_id":
                case.case_id,

            "status":
                case.status,

            "assignment": {

                "responder_id":
                    (
                        responder.responder_id
                        if responder
                        else
                        case.assigned_responder_id
                    ),

                "name":
                    (
                        responder.name
                        if responder
                        else
                        "Unknown"
                    ),
            },

            "message":
                "Case is already assigned.",
        }

    if case.status != "NEW":

        raise HTTPException(
            status_code=409,
            detail=(
                "Only NEW cases can be "
                "automatically assigned."
            ),
        )

    matches = get_responder_matches(
        case,
        db,
    )

    if not matches:

        return {

            "success":
                False,

            "assigned":
                False,

            "case_id":
                case.case_id,

            "status":
                case.status,

            "message": (
                "No suitable verified "
                "available responder "
                "is currently within range."
            ),
        }

    best_match = matches[0]

    responder = (
        db.query(Responder)
        .filter(
            Responder.responder_id
            ==
            best_match["responder_id"]
        )
        .first()
    )

    if not responder:

        raise HTTPException(
            status_code=500,
            detail=(
                "Selected responder "
                "could not be found."
            ),
        )

    now = utc_now()

    case.assigned_responder_id = (
        responder.responder_id
    )

    case.assigned_at = now

    case.status = "ASSIGNED"

    responder.active_cases = (
        responder.active_cases or 0
    ) + 1

    responder.total_cases = (
        responder.total_cases or 0
    ) + 1

    responder.availability = "BUSY"

    db.commit()

    db.refresh(case)

    db.refresh(responder)

    return {

        "success":
            True,

        "assigned":
            True,

        "already_assigned":
            False,

        "case_id":
            case.case_id,

        "status":
            case.status,

        "assignment": {

            "responder_id":
                responder.responder_id,

            "name":
                responder.name,

            "responder_type":
                responder.responder_type,

            "specialization":
                responder.specialization,

            "distance_km":
                best_match["distance_km"],

            "match_score":
                best_match["match_score"],

            "match_quality":
                best_match["match_quality"],

            "assigned_at":
                now.isoformat(),
        },

        "message": (
            "Best available responder "
            "has been automatically assigned."
        ),
    }


# ==================================================
# MANUAL RESPONDER ASSIGNMENT
# ==================================================

@app.post(
    "/cases/{case_id}/assign"
)
def assign_selected_responder(

    case_id: str,

    responder_id: str,

    db: Session = Depends(get_db),
):
    """
    Assign a reporter-selected responder.

    AI matching still determines which responders are suitable,
    but the human reporter/operator is allowed to choose any
    verified, available responder from that eligible list.
    """

    case = (
        db.query(Case)
        .filter(Case.case_id == case_id)
        .first()
    )

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found.",
        )

    if case.assigned_responder_id:
        assigned = assigned_responder_for_case(case, db)
        return {
            "success": True,
            "assigned": True,
            "already_assigned": True,
            "case_id": case.case_id,
            "status": case.status,
            "assignment": responder_dict(assigned),
            "message": "Case is already assigned.",
        }

    if case.status != "NEW":
        raise HTTPException(
            status_code=409,
            detail=(
                f"Only NEW cases can be assigned. "
                f"Current status is {case.status}."
            ),
        )

    responder = (
        db.query(Responder)
        .filter(Responder.responder_id == responder_id)
        .first()
    )

    if not responder:
        raise HTTPException(
            status_code=404,
            detail="Responder not found.",
        )

    if not responder.verified:
        raise HTTPException(
            status_code=403,
            detail="Responder is not verified.",
        )

    if responder.availability != "AVAILABLE":
        raise HTTPException(
            status_code=409,
            detail="Responder is not currently available.",
        )

    # The user can choose another responder, but only from the
    # AI-validated pool of suitable responders.
    matches = get_responder_matches(case, db)
    selected_match = next(
        (
            item
            for item in matches
            if item["responder_id"] == responder.responder_id
        ),
        None,
    )

    if not selected_match:
        raise HTTPException(
            status_code=409,
            detail=(
                "Selected responder is not an eligible match for "
                "this case. They must be verified, available, "
                "within service range and compatible with the animal."
            ),
        )

    now = utc_now()

    case.assigned_responder_id = responder.responder_id
    case.assigned_at = now
    case.status = "ASSIGNED"

    responder.active_cases = (responder.active_cases or 0) + 1
    responder.total_cases = (responder.total_cases or 0) + 1
    responder.availability = "BUSY"

    db.commit()
    db.refresh(case)
    db.refresh(responder)

    response_minutes = None
    created_at = getattr(case, "created_at", None)
    if created_at is not None:
        delta = (now - created_at).total_seconds() / 60
        if delta >= 0:
            response_minutes = round(delta, 2)

    return {
        "success": True,
        "assigned": True,
        "already_assigned": False,
        "assignment_source": "REPORTER_SELECTED",
        "ai_recommended": (
            bool(matches)
            and matches[0]["responder_id"] == responder.responder_id
        ),
        "case_id": case.case_id,
        "status": case.status,
        "assignment": {
            "responder_id": responder.responder_id,
            "name": responder.name,
            "responder_type": responder.responder_type,
            "specialization": responder.specialization,
            "distance_km": selected_match["distance_km"],
            "match_score": selected_match["match_score"],
            "match_quality": selected_match["match_quality"],
            "assigned_at": now.isoformat(),
            "response_time_minutes": response_minutes,
        },
        "message": (
            "Selected responder has been assigned successfully."
        ),
    }


# ==================================================
# RESPONDER CLAIM
# ==================================================

@app.post(
    "/cases/{case_id}/claim"
)
def claim_case(

    case_id: str,

    responder_id: str,

    db: Session = Depends(get_db),
):

    case = (
        db.query(Case)
        .filter(
            Case.case_id == case_id
        )
        .first()
    )

    if not case:

        raise HTTPException(
            status_code=404,
            detail="Case not found.",
        )

    responder = (
        db.query(Responder)
        .filter(
            Responder.responder_id
            == responder_id
        )
        .first()
    )

    if not responder:

        raise HTTPException(
            status_code=404,
            detail="Responder not found.",
        )

    if not responder.verified:

        raise HTTPException(
            status_code=403,
            detail="Responder is not verified.",
        )

    if case.assigned_responder_id:

        if (
            case.assigned_responder_id
            == responder.responder_id
        ):

            return {

                "success":
                    True,

                "claimed":
                    True,

                "already_claimed":
                    True,

                "case_id":
                    case.case_id,

                "status":
                    case.status,

                "responder":
                    responder_dict(
                        responder
                    ),

                "message": (
                    "Case is already assigned "
                    "to this responder."
                ),
            }

        raise HTTPException(
            status_code=409,
            detail=(
                "Case has already been assigned "
                "to another responder."
            ),
        )

    if case.status != "NEW":

        raise HTTPException(
            status_code=409,
            detail=(
                f"Case cannot be claimed "
                f"while status is {case.status}."
            ),
        )

    if responder.availability != "AVAILABLE":

        raise HTTPException(
            status_code=409,
            detail=(
                "Responder is not currently available."
            ),
        )

    matches = get_responder_matches(
        case,
        db,
    )

    own_match = next(
        (
            item
            for item in matches
            if item["responder_id"]
            == responder.responder_id
        ),
        None,
    )

    if not own_match:

        raise HTTPException(
            status_code=409,
            detail=(
                "This case is outside the responder's "
                "service range or does not match "
                "their specialization."
            ),
        )

    now = utc_now()

    case.assigned_responder_id = (
        responder.responder_id
    )

    case.assigned_at = now

    case.status = "ASSIGNED"

    responder.active_cases = (
        responder.active_cases or 0
    ) + 1

    responder.total_cases = (
        responder.total_cases or 0
    ) + 1

    responder.availability = "BUSY"

    db.commit()

    db.refresh(case)

    db.refresh(responder)

    return {

        "success":
            True,

        "claimed":
            True,

        "already_claimed":
            False,

        "case_id":
            case.case_id,

        "status":
            case.status,

        "assignment": {

            "responder_id":
                responder.responder_id,

            "name":
                responder.name,

            "distance_km":
                own_match["distance_km"],

            "match_score":
                own_match["match_score"],

            "match_quality":
                own_match["match_quality"],

            "assigned_at":
                now.isoformat(),
        },

        "message": (
            "Case successfully claimed "
            "by responder."
        ),
    }


# ==================================================
# UPDATE CASE STATUS
# ==================================================

@app.patch(
    "/cases/{case_id}/status"
)
def update_case_status(

    case_id: str,

    status: str,

    db: Session = Depends(get_db),
):

    status = (
        status
        .upper()
        .strip()
    )

    allowed_statuses = {
        "NEW",
        "ASSIGNED",
        "RESCUED",
        "RESOLVED",
    }

    if status not in allowed_statuses:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid status. "
                "Use NEW, ASSIGNED, "
                "RESCUED or RESOLVED."
            ),
        )

    case = (
        db.query(Case)
        .filter(
            Case.case_id == case_id
        )
        .first()
    )

    if not case:

        raise HTTPException(
            status_code=404,
            detail="Case not found.",
        )

    current = case.status

    valid_transitions = {

        "NEW": [
            "ASSIGNED"
        ],

        "ASSIGNED": [
            "RESCUED"
        ],

        "RESCUED": [
            "RESOLVED"
        ],

        "RESOLVED": [],
    }

    if status != current:

        if status not in valid_transitions.get(
            current,
            []
        ):

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid transition "
                    f"{current} -> {status}. "
                    f"Allowed flow: "
                    f"NEW -> ASSIGNED -> "
                    f"RESCUED -> RESOLVED."
                ),
            )

    if status == "RESCUED":

        if not case.assigned_responder_id:

            raise HTTPException(
                status_code=400,
                detail=(
                    "A case must be assigned "
                    "before it can be rescued."
                ),
            )

        case.rescued_at = utc_now()

    if status == "RESOLVED":

        if not case.assigned_responder_id:

            raise HTTPException(
                status_code=400,
                detail=(
                    "A case must have an assigned "
                    "responder before resolution."
                ),
            )

        case.resolved_at = utc_now()

        responder = (
            assigned_responder_for_case(
                case,
                db,
            )
        )

        if responder:

            responder.active_cases = max(
                0,
                (
                    responder.active_cases
                    or 1
                ) - 1,
            )

            if responder.active_cases == 0:

                responder.availability = (
                    "AVAILABLE"
                )

    case.status = status

    db.commit()

    db.refresh(case)

    return {

        "success":
            True,

        "case_id":
            case.case_id,

        "status":
            case.status,

        "message":
            (
                f"Case status updated "
                f"to {case.status}."
            ),
    }


# ==================================================
# RESPONDER AVAILABILITY
# ==================================================

@app.patch(
    "/responders/{responder_id}/availability"
)
def update_responder_availability(

    responder_id: str,

    availability: str,

    db: Session = Depends(get_db),
):

    availability = (
        availability
        .upper()
        .strip()
    )

    allowed = {
        "AVAILABLE",
        "BUSY",
        "OFFLINE",
    }

    if availability not in allowed:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid availability. "
                "Use AVAILABLE, BUSY or OFFLINE."
            ),
        )

    responder = (
        db.query(Responder)
        .filter(
            Responder.responder_id
            ==
            responder_id
        )
        .first()
    )

    if not responder:

        raise HTTPException(
            status_code=404,
            detail="Responder not found.",
        )

    if (
        availability == "AVAILABLE"
        and (
            responder.active_cases
            or 0
        ) > 0
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Responder has active cases "
                "and cannot be marked AVAILABLE."
            ),
        )

    responder.availability = availability

    db.commit()

    db.refresh(responder)

    return {

        "success":
            True,

        "responder_id":
            responder.responder_id,

        "availability":
            responder.availability,
    }


# ==================================================
# CASE STATISTICS
# ==================================================

@app.get("/statistics")
def get_statistics(
    db: Session = Depends(get_db),
):

    total_cases = db.query(Case).count()

    new_cases = db.query(Case).filter(
        Case.status == "NEW"
    ).count()

    assigned_cases = db.query(Case).filter(
        Case.status == "ASSIGNED"
    ).count()

    rescued_cases = db.query(Case).filter(
        Case.status == "RESCUED"
    ).count()

    resolved_cases = db.query(Case).filter(
        Case.status == "RESOLVED"
    ).count()

    critical_cases = db.query(Case).filter(
        Case.priority == "CRITICAL"
    ).count()

    high_cases = db.query(Case).filter(
        Case.priority == "HIGH"
    ).count()

    moderate_cases = db.query(Case).filter(
        Case.priority == "MODERATE"
    ).count()

    low_cases = db.query(Case).filter(
        Case.priority == "LOW"
    ).count()

    total_responders = db.query(Responder).count()

    available_responders = db.query(Responder).filter(
        Responder.availability == "AVAILABLE",
        Responder.verified == 1,
    ).count()

    # Real average response = report creation -> responder assignment.
    # Do not use a fabricated fixed number. Cases without both timestamps
    # are excluded from the average.
    response_times = []

    for case in db.query(Case).all():
        created_at = getattr(case, "created_at", None)
        assigned_at = getattr(case, "assigned_at", None)

        if created_at is None or assigned_at is None:
            continue

        minutes = (assigned_at - created_at).total_seconds() / 60

        if minutes >= 0:
            response_times.append(minutes)

    average_response_minutes = None
    if response_times:
        average_response_minutes = round(
            sum(response_times) / len(response_times),
            2,
        )

    return {
        "cases": {
            "total": total_cases,
            "new": new_cases,
            "assigned": assigned_cases,
            "rescued": rescued_cases,
            "resolved": resolved_cases,
        },
        "priority": {
            "critical": critical_cases,
            "high": high_cases,
            "moderate": moderate_cases,
            "low": low_cases,
        },
        "responders": {
            "total": total_responders,
            "available": available_responders,
        },
        "response": {
            "average_minutes": average_response_minutes,
            "cases_included": len(response_times),
        },
    }


# ==================================================
# SEED DEMO RESPONDERS
# ==================================================

def seed_demo_responders():

    db = SessionLocal()

    try:

        existing_count = (
            db.query(Responder)
            .count()
        )

        if existing_count > 0:
            return

        demo_responders = [

            Responder(

                responder_id="R-WILD-001",

                name="Wildlife Rescue Team",

                responder_type="Wildlife Rescue",

                specialization=
                    "Wildlife / Birds",

                latitude=28.6139,

                longitude=77.2090,

                service_radius_km=10,

                availability="AVAILABLE",

                verified=1,

                active_cases=0,

                total_cases=0,
            ),

            Responder(

                responder_id="R-ANML-002",

                name="Animal Rescue Volunteer",

                responder_type="Animal Rescue",

                specialization=
                    "Dogs / Cats / Animal Rescue",

                latitude=28.6200,

                longitude=77.2150,

                service_radius_km=5,

                availability="AVAILABLE",

                verified=1,

                active_cases=0,

                total_cases=0,
            ),

            Responder(

                responder_id="R-VET-003",

                name="Emergency Veterinary Clinic",

                responder_type="Veterinary Clinic",

                specialization=
                    "Emergency Veterinary Care / Dogs / Cats",

                latitude=28.6300,

                longitude=77.2200,

                service_radius_km=8,

                availability="AVAILABLE",

                verified=1,

                active_cases=0,

                total_cases=0,
            ),

            Responder(

                responder_id="R-BIRD-004",

                name="Bird Rescue Network",

                responder_type="Wildlife Rescue",

                specialization=
                    "Birds / Wildlife",

                latitude=28.6000,

                longitude=28.2000,

                service_radius_km=15,

                availability="AVAILABLE",

                verified=1,

                active_cases=0,

                total_cases=0,
            ),
        ]

        # Fix demo longitude for Delhi.
        demo_responders[-1].longitude = 77.2000

        db.add_all(
            demo_responders
        )

        db.commit()

        print(
            "Responder network seeded successfully."
        )

    except Exception as e:

        db.rollback()

        print(
            "Responder seed error:",
            str(e)
        )

    finally:

        db.close()


# ==================================================
# STARTUP
# ==================================================

seed_demo_responders()
