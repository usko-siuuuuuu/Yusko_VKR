project/
├── docker-compose.yml
├── .env
├── .env.example
├── .gitignore
├── progress.md
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    ├── main.py
    ├── core/
    │   ├── __init__.py
    │   ├── config.py
    │   ├── database.py
    │   ├── dependencies.py
    │   ├── security.py
    │   └── storage.py
    ├── models/
    │   ├── __init__.py
    │   ├── attachment.py
    │   ├── construction_object.py
    │   ├── contractor.py
    │   ├── defect_cause.py
    │   ├── issue.py
    │   ├── location.py
    │   ├── user.py
    │   └── work_type.py
    ├── schemas/
    │   ├── __init__.py
    │   ├── analytics.py
    │   ├── attachment.py
    │   ├── catalogs.py
    │   ├── issue.py
    │   └── user.py
    ├── routers/
    │   ├── __init__.py
    │   ├── analytics.py
    │   ├── attachments.py
    │   ├── auth.py
    │   ├── catalogs.py
    │   └── issues.py
    └── db/
        └── init/
            └── 01_schema.sql