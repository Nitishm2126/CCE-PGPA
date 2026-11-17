from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, Field


class SemesterPointConfig(BaseModel):
    semester_number: int = Field(..., ge=1, le=8, description="Academic semester number 1 to 8")
    is_enabled: bool = Field(True, description="Whether this component applies in this semester")
    min_points: float = Field(0.0, ge=0.0, description="Minimum applicable points")
    max_points: float = Field(..., ge=0.0, description="Maximum applicable points or target score")
    credit_value: int = Field(3, ge=0, le=10, description="Applicable semester credits")
    scale_label: Optional[str] = Field(None, description="Human readable scale display")
    guideline: Optional[str] = Field(None, description="Semester specific guideline / scoring rule")
    grade_thresholds: Optional[Dict[str, float]] = Field(None, description="Grade cutoffs e.g. {'O': 500, 'A+': 400}")
    rules_description: Optional[str] = Field(None, description="Descriptive notes or evaluation rules")


class ComponentPointSettingsResponse(BaseModel):
    component_id: uuid.UUID
    component_name: str
    component_slug: str
    credit_value: int
    unit: str
    default_min_points: float
    default_max_points: float
    scale_label: str
    guideline: str
    semesters: List[SemesterPointConfig]
    updated_at: Optional[datetime] = None
    updated_by_name: Optional[str] = None


class ComponentPointSettingsUpdatePayload(BaseModel):
    unit: Optional[str] = None
    default_min_points: Optional[float] = Field(None, ge=0.0)
    default_max_points: Optional[float] = Field(None, ge=0.0)
    scale_label: Optional[str] = None
    guideline: Optional[str] = None
    semesters: List[SemesterPointConfig]
