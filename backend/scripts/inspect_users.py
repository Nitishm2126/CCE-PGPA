import os
from dotenv import load_dotenv
load_dotenv('backend/.env')
from sqlalchemy import create_engine, text

engine = create_engine(os.getenv('DATABASE_URL'))
with engine.connect() as conn:
    print('=== USERS (admin, hod, mentor) ===')
    users = conn.execute(text("SELECT id, full_name, email, role, is_active, must_change_password FROM users WHERE role IN ('admin', 'hod', 'mentor') OR email LIKE '%pachaiammal%' OR email LIKE '%hod%'")).fetchall()
    for u in users:
        print(u)

    print('\n=== HOD PROFILES ===')
    hods = conn.execute(text("SELECT * FROM hod_profiles")).fetchall()
    for h in hods:
        print(h)

    print('\n=== MENTOR PROFILES ===')
    mentors = conn.execute(text("SELECT * FROM mentor_profiles")).fetchall()
    for m in mentors:
        print(m)

    print('\n=== MENTOR ASSIGNMENTS COUNT BY MENTOR ===')
    assigns = conn.execute(text("""
        SELECT ma.mentor_id, u.email, u.full_name, COUNT(ma.id)
        FROM mentor_assignments ma
        JOIN users u ON u.id = ma.mentor_id
        GROUP BY ma.mentor_id, u.email, u.full_name
    """)).fetchall()
    for a in assigns:
        print(a)

    print('\n=== HOD USER RECORD ===')
    row = conn.execute(text("SELECT id, email, full_name, role, password_hash, firebase_uid, must_change_password FROM users WHERE id = '415dae44-4656-4c48-8a73-03f8571f6d25'")).fetchone()
    print(row)

