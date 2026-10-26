"""Create synthetic Supabase accounts for local development only.

Required environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
SUPABASE_ANON_KEY, DEMO_TEACHER_PASSWORD, DEMO_STUDENT_PASSWORD.
Never use these sample identities or credentials with real student data.
"""
from __future__ import annotations

import os

from supabase import create_client


ACCOUNTS = [
    {
        "email": "teacher@demo.edu",
        "name": "Professor Demo",
        "registration_id": "PROF-001",
        "role": "teacher",
        "password_env": "DEMO_TEACHER_PASSWORD",
    },
    {
        "email": "student1@demo.edu",
        "name": "Student One",
        "registration_id": "STU-001",
        "role": "student",
        "password_env": "DEMO_STUDENT_PASSWORD",
    },
    {
        "email": "student2@demo.edu",
        "name": "Student Two",
        "registration_id": "STU-002",
        "role": "student",
        "password_env": "DEMO_STUDENT_PASSWORD",
    },
]


def main() -> None:
    if os.getenv("ATTENDANCE_ENV", "development").lower() == "production" and os.getenv("SEED_ALLOW_PRODUCTION") != "1":
        raise SystemExit("Refusing to seed accounts in production. Set SEED_ALLOW_PRODUCTION=1 only for an explicitly approved test environment.")
    required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"]
    missing = [name for name in required if not os.getenv(name)]
    missing.extend(account["password_env"] for account in ACCOUNTS if not os.getenv(account["password_env"] or ""))
    if missing:
        raise SystemExit("Missing required environment variables: " + ", ".join(sorted(set(missing))))

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    user_ids: dict[str, str] = {}
    existing = client.auth.admin.list_users()
    by_email = {user.email.lower(): user for user in existing}
    for account in ACCOUNTS:
        email = str(account["email"])
        user = by_email.get(email)
        if user is None:
            created = client.auth.admin.create_user(
                {
                    "email": email,
                    "password": os.environ[str(account["password_env"])],
                    "email_confirm": True,
                    "user_metadata": {"name": account["name"]},
                }
            )
            user = created.user
        if user is None:
            raise RuntimeError(f"Could not create or locate {email}")
        user_ids[email] = user.id
        client.table("profiles").upsert(
            {
                "id": user.id,
                "name": account["name"],
                "email": email,
                "role": account["role"],
                "registration_id": account["registration_id"],
            }
        ).execute()
        print(f"Ready: {account['role']} {account['registration_id']} ({email})")

    teacher_id = user_ids["teacher@demo.edu"]
    class_result = client.table("classes").select("id").eq("code", "CS-101").limit(1).execute()
    if class_result.data:
        class_id = class_result.data[0]["id"]
    else:
        created_class = client.table("classes").insert(
            {"name": "Classroom Attendance Demo", "code": "CS-101", "teacher_id": teacher_id}
        ).execute()
        class_id = created_class.data[0]["id"]
    enrollments = [
        {"class_id": class_id, "student_id": user_ids[email]}
        for email in ("student1@demo.edu", "student2@demo.edu")
    ]
    client.table("enrollments").upsert(enrollments, on_conflict="class_id,student_id").execute()
    print("Ready: CS-101 with 2 synthetic students")
    print("Passwords were supplied through environment variables and are not printed.")


if __name__ == "__main__":
    main()
