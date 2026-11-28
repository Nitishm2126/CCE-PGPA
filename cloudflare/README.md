# CCE-PGPA Cloudflare Migration Workspace (Stage 1 Foundation)

**Academic Institution:** Department of Computer and Communication Engineering (CCE), Sri Sairam Engineering College  
**System Reference:** CCE Achieve PGPA Student Achievement Management System  
**Stage:** Stage 1 Foundation Established (Isolated Staging Environment)  
**Permanent Evidence Storage:** Google Drive (All certificate & photo file binaries)  
**Permanent Database Engine:** Cloudflare D1 (All structured records, metadata & OAuth tokens)

---

## 1. Overview & Cloudflare Architecture

This workspace establishes the isolated Cloudflare foundation for migrating the CCE-PGPA portal to Cloudflare's serverless edge infrastructure.

### Target Architecture:
- **Compute:** Cloudflare Python Workers (Pyodide WebAssembly runtime)
- **Database:** Cloudflare D1 (Serverless SQLite engine, APAC region)
- **Evidence File Binaries:** **Google Drive Cloud Storage** (Permanent storage location for all student certificates, marksheet PDFs, and photos)
- **Frontend Hosting:** Cloudflare Pages / Workers Static Assets (Next.js client export)

---

## 2. Configured Staging Resources

| Resource Type | Resource Identifier | Binding Name | Status |
| :--- | :--- | :--- | :--- |
| **Cloudflare Worker** | `cce-pgpa-staging` | — | **Live at:** `https://cce-pgpa-staging.nitishms007.workers.dev` |
| **Cloudflare D1 Database** | `cce-pgpa-db-staging`<br>(ID: `712c3d22-e6ab-4257-90eb-976626a8511a`) | `env.DB` | **19 Tables Provisioned (APAC Region)** |
| **Evidence Storage** | **Google Drive Cloud Storage** | — | **Permanent evidence repository** (D1 stores metadata & OAuth tokens only) |

---

## 3. Directory Layout

```
E:\Projects\CCE-PGPA-Cloudflare/
├── src/
│   └── main.py                     # Native Cloudflare Python Worker with D1 & Google Drive probes
├── migrations/
│   └── 0001_initial_schema.sql     # Full 19-table relational schema for D1 (includes OAuth & folder mappings)
├── tests/
│   └── test_staging_endpoints.py   # Automated verification test suite
├── .dev.vars                       # Local development secrets template
├── .env.example                    # Staging configuration reference
├── pyproject.toml                  # Python project metadata and tooling
├── wrangler.toml                   # Cloudflare Wrangler configuration
└── README.md                       # Stage 1 documentation and runbook
```

---

## 4. Live Staging Endpoints

The staging worker is deployed and accessible at:

| Endpoint | Method | Purpose | Verified Output |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | Service metadata & runtime information | HTTP 200, status `online`, storage `google_drive` |
| `/api/v1/health` | `GET` | Live D1 connectivity & storage probe | HTTP 200, D1 status `connected`, storage `google_drive` |
| `/api/v1/d1-probe` | `GET` | Schema integrity probe across all 19 tables | HTTP 200, 19 tables verified (including OAuth & Drive folders) |

---

## 5. Google Drive Integration Architecture & Requirements

1. **Storage Mandate:**
   - Certificate and photo binaries reside exclusively in Google Drive.
   - Cloudflare D1 stores only structured file metadata in `achievement_files` (`drive_file_id`, `drive_folder_id`, `original_filename`, `mime_type`, `size_bytes`, `file_category`).
2. **OAuth 2.0 Web Server Flow:**
   - Personal institutional Gmail account authorizes access via Google OAuth 2.0 consent screen.
   - Offline refresh tokens are stored encrypted in the D1 `oauth_credentials` table.
3. **Semester Subfolder Hierarchy:**
   - Mapped persistently in `student_semester_folders` (Student Root $\rightarrow$ Semester 1..8 subfolders).
4. **Security & Privacy:**
   - Files are uploaded with private access to the CCE Drive. Open public links are prohibited.
   - File viewing is proxied through the backend `/api/v1/files/{file_id}/content` enforcing role verification (Student ownership, Mentor mentee assignment, or HOD department oversight).

---

## 6. Development & Deployment Commands

### Local Development
```bash
npx wrangler dev
```

### Staging Database Schema Migrations
```bash
# Apply schema to remote staging D1 database
npx wrangler d1 execute cce-pgpa-db-staging --remote --file=migrations/0001_initial_schema.sql

# Inspect tables on remote D1 database
npx wrangler d1 execute cce-pgpa-db-staging --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

### Staging Edge Deployment
```bash
npx wrangler deploy
```

### Automated Staging Verification Tests
```bash
py -3.12 tests/test_staging_endpoints.py
```

---

## 7. Security & Invariant Rules
- The original production project (`E:\Projects\pgpa web-app`) is strictly **read-only**.
- No production data or credentials have been copied or migrated.
- Cloudflare R2 is **not required and not activated**.
- All production operations on Render, Vercel, and Google Drive continue without interruption.
