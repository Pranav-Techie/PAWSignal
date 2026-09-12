from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    Text,
    DateTime,
)

from sqlalchemy.orm import (
    declarative_base,
    sessionmaker,
)


# ==================================================
# DATABASE CONFIGURATION
# ==================================================

DATABASE_URL = "sqlite:///./pawsignal.db"


engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False
    },
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


Base = declarative_base()


# ==================================================
# DATABASE SESSION
# ==================================================

def get_db():

    db = SessionLocal()

    try:

        yield db

    finally:

        db.close()


# ==================================================
# CASE MODEL
# ==================================================

class Case(Base):

    __tablename__ = "cases"


    # ----------------------------------------------
    # PRIMARY KEY
    # ----------------------------------------------

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )


    # ----------------------------------------------
    # CASE INFORMATION
    # ----------------------------------------------

    case_id = Column(
        String,
        unique=True,
        index=True,
        nullable=False,
    )

    latitude = Column(
        String,
        nullable=True,
    )

    longitude = Column(
        String,
        nullable=True,
    )

    description = Column(
        Text,
        nullable=True,
    )

    image_filename = Column(
        String,
        nullable=True,
    )


    # ----------------------------------------------
    # AI ANALYSIS
    # ----------------------------------------------

    species = Column(
        String,
        nullable=True,
    )

    visible_injury = Column(
        Integer,
        default=0,
    )

    injury_severity = Column(
        Integer,
        default=0,
    )

    mobility_impairment = Column(
        Integer,
        default=0,
    )

    bleeding = Column(
        Integer,
        default=0,
    )

    environmental_danger = Column(
        Integer,
        default=0,
    )

    vulnerability = Column(
        Integer,
        default=0,
    )

    confidence = Column(
        Float,
        default=0,
    )


    # ----------------------------------------------
    # PAWSCORE
    # ----------------------------------------------

    score = Column(
        Integer,
        default=0,
    )

    priority = Column(
        String,
        nullable=True,
    )

    recommendation = Column(
        Text,
        nullable=True,
    )


    # ----------------------------------------------
    # CASE STATUS
    # ----------------------------------------------

    status = Column(
        String,
        default="NEW",
    )


    # ----------------------------------------------
    # RESPONDER ASSIGNMENT
    # ----------------------------------------------

    assigned_responder_id = Column(
        String,
        nullable=True,
    )

    assigned_at = Column(
        DateTime,
        nullable=True,
    )


    # ----------------------------------------------
    # RESCUE TIMESTAMPS
    # ----------------------------------------------

    rescued_at = Column(
        DateTime,
        nullable=True,
    )

    resolved_at = Column(
        DateTime,
        nullable=True,
    )


    # ----------------------------------------------
    # AI DETAILS
    # ----------------------------------------------

    observations = Column(
        Text,
        nullable=True,
    )

    reasons = Column(
        Text,
        nullable=True,
    )


# ==================================================
# RESPONDER MODEL
# ==================================================

class Responder(Base):

    __tablename__ = "responders"


    # ----------------------------------------------
    # PRIMARY KEY
    # ----------------------------------------------

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )


    # ----------------------------------------------
    # RESPONDER INFORMATION
    # ----------------------------------------------

    responder_id = Column(
        String,
        unique=True,
        index=True,
        nullable=False,
    )

    name = Column(
        String,
        nullable=False,
    )

    responder_type = Column(
        String,
        nullable=False,
    )

    specialization = Column(
        String,
        nullable=True,
    )


    # ----------------------------------------------
    # LOCATION
    # ----------------------------------------------

    latitude = Column(
        Float,
        nullable=True,
    )

    longitude = Column(
        Float,
        nullable=True,
    )

    service_radius_km = Column(
        Float,
        default=10,
    )


    # ----------------------------------------------
    # AVAILABILITY
    # ----------------------------------------------

    availability = Column(
        String,
        default="AVAILABLE",
    )

    verified = Column(
        Integer,
        default=1,
    )


    # ----------------------------------------------
    # WORKLOAD
    # ----------------------------------------------

    active_cases = Column(
        Integer,
        default=0,
    )

    total_cases = Column(
        Integer,
        default=0,
    )


# ==================================================
# CREATE DATABASE TABLES
# ==================================================

Base.metadata.create_all(
    bind=engine
)