import io
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models.component import ComponentSemesterConfig, PGPAComponent
from app.models.grading import StudentComponentResult, StudentSemesterPGPA
from app.models.semester import Semester
from app.models.user import StudentProfile, User, UserRole


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_admin_semester_matrix_and_update(client: TestClient, db: Session):
    admin = db.scalars(select(User).where(User.role == UserRole.ADMIN)).first()
    assert admin is not None
    token = create_access_token(subject=admin.id, role="admin")

    res = client.get(
        "/api/v1/admin/components/semester-matrix",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["components"]) == 14
    assert len(data["semesters"]) == 8

    first = data["components"][0]
    comp_id = first["component_id"]
    sem_id = data["semesters"][0]["id"]
    curr_enabled = first["semesters"]["1"]

    patch_res = client.patch(
        f"/api/v1/admin/components/{comp_id}/semesters/{sem_id}",
        json={"is_enabled": not curr_enabled},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_enabled"] == (not curr_enabled)

    # Revert back
    client.patch(
        f"/api/v1/admin/components/{comp_id}/semesters/{sem_id}",
        json={"is_enabled": curr_enabled},
        headers={"Authorization": f"Bearer {token}"},
    )


def test_hod_import_template_and_preview(client: TestClient, db: Session):
    hod = db.scalars(select(User).where(User.role == UserRole.HOD)).first()
    assert hod is not None
    token = create_access_token(subject=hod.id, role="hod")

    comp = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "skillrack")).first()
    assert comp is not None
    sem = db.scalars(select(Semester).where(Semester.semester_number == 1)).first()
    assert sem is not None

    # Test template download
    res_tmpl = client.get(
        f"/api/v1/hod/import/template?component_id={comp.id}&semester_id={sem.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_tmpl.status_code == 200
    assert res_tmpl.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(res_tmpl.content) > 1000

    # Test preview with CSV
    student = db.scalars(
        select(StudentProfile).join(User).where(User.is_active.is_(True))
    ).first()
    assert student is not None

    csv_data = (
        "register_number,full_name,passed_points\n"
        f"{student.register_number},{student.user.full_name},550\n"
        "999999999999,Unknown Student,100\n"
    )

    files = {
        "file": ("test_import.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")
    }
    data = {
        "component_id": str(comp.id),
        "semester_id": str(sem.id),
    }

    res_prev = client.post(
        "/api/v1/hod/import/preview",
        data=data,
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_prev.status_code == 200
    preview = res_prev.json()
    assert preview["total_rows"] == 2
    assert preview["valid_rows"] == 1
    assert preview["error_rows"] == 1
    assert preview["rows"][0]["is_valid"] is True
    assert preview["rows"][0]["calculated_grade"] == "O"
    assert preview["rows"][0]["grade_points"] == 10
    assert preview["rows"][1]["is_valid"] is False
    assert "not found" in preview["rows"][1]["error_message"].lower()


def test_hod_confirm_import_and_student_pgpa(client: TestClient, db: Session):
    hod = db.scalars(select(User).where(User.role == UserRole.HOD)).first()
    assert hod is not None
    t_hod = create_access_token(subject=hod.id, role="hod")

    comp_sr = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "skillrack")).first()
    comp_gpa = db.scalars(select(PGPAComponent).where(PGPAComponent.slug == "academics-gpa")).first()
    sem = db.scalars(select(Semester).where(Semester.semester_number == 1)).first()

    student_prof = db.scalars(
        select(StudentProfile).join(User).where(User.is_active.is_(True))
    ).first()
    assert student_prof is not None
    student_user = student_prof.user

    # 1. Preview & Confirm Skillrack result (3 credits, 550 pts in Sem 1 -> O -> 10 pts)
    csv_sr = (
        "register_number,points\n"
        f"{student_prof.register_number},550\n"
    )
    res_sr_prev = client.post(
        "/api/v1/hod/import/preview",
        data={"component_id": str(comp_sr.id), "semester_id": str(sem.id)},
        files={"file": ("sr.csv", io.BytesIO(csv_sr.encode("utf-8")), "text/csv")},
        headers={"Authorization": f"Bearer {t_hod}"},
    )
    assert res_sr_prev.status_code == 200
    token_sr = res_sr_prev.json()["preview_token"]

    res_sr_conf = client.post(
        "/api/v1/hod/import/confirm",
        json={"preview_token": token_sr},
        headers={"Authorization": f"Bearer {t_hod}"},
    )
    assert res_sr_conf.status_code == 200

    # 2. Preview & Confirm Academics GPA result (8.50 GPA -> 8.50 pts)
    csv_gpa = (
        "register_number,gpa\n"
        f"{student_prof.register_number},8.50\n"
    )
    res_gpa_prev = client.post(
        "/api/v1/hod/import/preview",
        data={"component_id": str(comp_gpa.id), "semester_id": str(sem.id)},
        files={"file": ("gpa.csv", io.BytesIO(csv_gpa.encode("utf-8")), "text/csv")},
        headers={"Authorization": f"Bearer {t_hod}"},
    )
    assert res_gpa_prev.status_code == 200
    token_gpa = res_gpa_prev.json()["preview_token"]

    res_gpa_conf = client.post(
        "/api/v1/hod/import/confirm",
        json={"preview_token": token_gpa},
        headers={"Authorization": f"Bearer {t_hod}"},
    )
    assert res_gpa_conf.status_code == 200

    # 3. Check student's component results
    t_student = create_access_token(subject=student_user.id, role="student")
    res_results = client.get(
        f"/api/v1/students/me/component-results?semester_id={sem.id}",
        headers={"Authorization": f"Bearer {t_student}"},
    )
    assert res_results.status_code == 200
    results_data = res_results.json()
    assert len(results_data) >= 2
    sr_res = next(r for r in results_data if r["component_id"] == str(comp_sr.id))
    assert sr_res["grade"] == "O"
    assert sr_res["grade_points"] == 10.0

    # 4. Check student's PGPA report
    res_pgpa = client.get(
        f"/api/v1/students/me/pgpa?semester_id={sem.id}",
        headers={"Authorization": f"Bearer {t_student}"},
    )
    assert res_pgpa.status_code == 200
    pgpa_data = res_pgpa.json()
    assert pgpa_data["semester_number"] == 1
    # A1 = 10 * 3 / 3 = 10.0
    # PGPA = 10.0 * 0.6 + 8.50 * 0.4 = 6.0 + 3.4 = 9.40
    assert pgpa_data["a1_score"] == 10.0
    assert pgpa_data["semester_gpa"] == 8.5
    assert pgpa_data["pgpa"] == 9.4
