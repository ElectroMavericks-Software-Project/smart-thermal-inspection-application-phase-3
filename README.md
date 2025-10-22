# Smart Thermal Inspection Application (Phase 3)

End-to-end platform for managing distribution transformer assets, thermal inspection imagery, automated anomaly detection, and human-in-the-loop annotation feedback. Phase 3 extends the Phase 1–2 foundations with persistent annotation workflows, audit trails, and export tooling for model retraining.

## Repository Layout
- `backend/` – Spring Boot 3.5 service (Java 17) with PostgreSQL/H2 persistence.
- `backend/Transformer anomaly/` – Python inference and training assets (`model.py`, YOLO fine-tuning scripts, notebooks, requirements).
- `frontend/` – React 18 + Vite + Tailwind UI for transformer management, inspections, and annotation review.
- `database/` – DDL, sample data seeds, and SQL migrations (including Phase 3 annotation table).
- `docs/` – Assignment brief and reference material.
- `apply_annotations_migration.(bat|sh)` – Helper scripts to apply the Phase 3 annotation migration to PostgreSQL.

## Technology Stack
- Spring Boot 3.5, Spring Data JPA, Bean Validation, Lombok
- PostgreSQL 14+ (default) or embedded H2 demo profile
- React 18, Vite, TypeScript, Tailwind, shadcn/ui
- Python 3.10+, `supervision`, OpenCV, Ultralytics tooling
- Storage on filesystem (`media/`, `storage/`) surfaced via Spring static resources

## Implemented Functionality
### Phase 1 – Transformer & Baseline Management
- Admin dashboard (`frontend/src/pages/Dashboard.tsx`) lists transformers with search, region/type filters, starring, inline edit, and delete options backed by `TransformerController`.
- Guided add flow (`AddTransformer.tsx`) creates transformer records, validates metadata, and uploads baseline thermal images to `media/baseline`, automatically stamping uploader and timestamps (`BaselineService` + `BaselineUploadController`).
- Baseline retrieval endpoint (`TransformerBaselineController`) exposes latest image and metadata for UI previews.
- Relational schema (`database/init/01-schema.sql`) models transformers and inspections; seed data (`02-test-data.sql`) provides ≥5 transformers with baseline paths for evaluation.

### Phase 2 – Automated Anomaly Detection
- Maintenance uploads (`ThermalImageUpload.tsx` + `MediaUploadController`) store current inspections, capture weather (sunny/cloudy/rainy), mark uploader, and trigger AI analysis against the paired baseline.
- Inspection review UI (`InspectionDetail.tsx`) renders baseline vs. current images, overlays detections, supports zoom/pan, and shows detection metadata (class, confidence, timestamps).
- Detection metadata persisted to DB (`InspectionAnnotation` entity) to support later review and export.

### Phase 3 – Interactive Annotation & Feedback
- Rich annotation tools in `InspectionDetail.tsx` allow resizing, repositioning, soft delete/restore, and new contour drawing (with class selection, notes, automatic numbering, and badge color coding).
- Backend persistence (`POST /api/save-annotations`, `GET /api/get-annotations/{inspectionId}`) stores full annotation JSON, type (`Detected by AI`, `Edited`, `Manual`, `Deleted`), user metadata, and bounding boxes in the new `inspection_annotations` table.
- Automatic reload: visiting an inspection rehydrates saved annotations, falling back to localStorage cache if backend is offline.
- Feedback log export: `GET /api/get-annotations/{inspectionId}` returns the final accepted annotations in JSON, and `POST /api/retrain/export-dataset` materializes YOLO-style `images/` + `labels/` under `Transformer anomaly/Anomly Detection/data/new annotations` for retraining.
- Helper migration scripts ensure existing databases gain the `inspection_annotations` table before upgrading the backend.

### Additional Utilities
- `DatasetExportController` cleans output directories and normalizes bbox coordinates for training readiness.
- `MediaInspectionController` supplies combined baseline/current media metadata to keep the UI responsive.
- `test_upload.py` is a standalone runner to validate AI analysis with arbitrary thermal images.
- Demo profile (`application-demo.yml` + `DemoDataInitializer`) boots the backend with in-memory H2, seeded transformers, and inspection records for quick testing.

## System Architecture
```
React UI (Vite, Tailwind)
        │  REST (JSON)
        ▼
Spring Boot API ──► PostgreSQL / H2
        │
        └─► Python model.py 
```
File storage for baseline and inspection media sits under `backend/media` (served at `/media/**`) and `backend/storage` (inspection assets).

## Prerequisites
- Java 17 and Maven 3.9+ (or use the bundled `mvnw` wrapper)
- Node.js 18+ (or Bun) and npm
- Python 3.10+ with `pip`
- PostgreSQL 14+ (unless using the demo H2 profile)
- Git, PowerShell/Bash, and `python` available on your PATH


## Setup & Configuration
1. **Clone the repository**
   ```bash
   git clone https://github.com/ElectroMavericks-Software-Project/smart-thermal-inspection-application-phase-3.git
   cd smart-thermal-inspection-application-phase-3
   ```

2. **Prepare the database**
   - Create a PostgreSQL database (defaults in `application.yml`): `jdbc:postgresql://localhost:5432/sti`, user/password `sti/sti`.
   - Run DDL and seed data:
     ```bash
     psql -h localhost -U sti -d sti -f database/init/01-schema.sql
     psql -h localhost -U sti -d sti -f database/init/02-test-data.sql
     ```
   - Apply the Phase 3 migration for `inspection_annotations` (choose the script for your OS):
     ```bash
     # Windows
     apply_annotations_migration.bat

     # macOS/Linux
     chmod +x apply_annotations_migration.sh
     ./apply_annotations_migration.sh
     ```
   - Alternatively, launch the backend with the demo profile to use in-memory H2 plus auto-seeded data:
     ```bash
     cd backend
     ./mvnw spring-boot:run -Dspring-boot.run.profiles=demo
     ```

3. **Provision media files**
   - Create folders `backend/media/baseline` and `backend/media/inspections` (Spring will auto-create at runtime, but pre-creating prevents permission issues).
   - Copy the provided baseline and inspection sample images (shared via Moodle submission package) so the seeded rows reference existing files (e.g., `backend/media/baseline/AZ-1123.jpg`).

4. **Install Python dependencies**
   ```bash
   cd backend/"Transformer anomaly"
   python -m venv .venv
   source .venv/bin/activate    # Windows: .venv\Scripts\activate
   pip install -r "Anomly Detection/requirements.txt"
   pip install inference_sdk supervision

   - Ensure the `python` interpreter on PATH matches the environment containing the dependencies (the backend invokes `python model_api.py`).

5. **Configure and run the backend**
   ```bash
   cd backend
   # Optional: override DB creds or media paths via environment variables before launch
   ./mvnw spring-boot:run
   ```
   The API listens on `http://localhost:8080` by default, serving swagger at `/swagger`.

6. **Configure and run the frontend**
   ```bash
   cd frontend
   npm install          # or bun install
   echo "VITE_API_URL=http://localhost:8080" > .env.local
   npm run dev          # Vite dev server on http://localhost:5173
   ```
   - The mock login accepts any email/password and stores the user in `localStorage`.
   - Build for production with `npm run build` and preview via `npm run preview`.

## Typical Workflow
1. **Log in** using any email/password to seed local session data.
2. **Manage transformers** from the dashboard: add new entries, edit metadata, star favorites, or delete unneeded records. The “Add Transformer” wizard will prompt for a baseline image upload.
3. **Upload or review baselines**: `AddTransformer.tsx` invokes `/api/upload_baseline_transformer`, which stores the file under `media/baseline/<transformerNo>.<ext>` and updates metadata.
4. **Create an inspection** from the transformer detail view, then open the upload screen. Choose the maintenance thermal image, weather condition (Sunny/Cloudy/Rainy), and the uploader name is auto-populated from the logged-in user.
5. **Run AI detection**: after the maintenance upload succeeds, the frontend calls `/api/analyze-thermal-image`. The backend runs `model_api.py` and returns detections with class, confidence, and bounding boxes.
6. **Validate annotations** in the inspection detail view:
   - Drag handles to adjust boxes, resize via corner grips, or delete incorrect detections.
   - Add new anomalies via “Add Contour” (draw, classify, annotate with notes).
   - Toggle edit mode, zoom/pan the heatmap, and view badges showing annotation provenance.
7. **Persist feedback** using the “Confirm changes” action, which POSTs to `/api/save-annotations`. The response includes counts by annotation type. Reloading the page (or another user opening the inspection) automatically restores the saved annotations.
8. **Export data** when ready for model retraining:
   - `curl -X POST http://localhost:8080/api/retrain/export-dataset` writes YOLO-ready `images/` and `labels/` under `backend/Transformer anomaly/Anomly Detection/data/new annotations`.
   - `curl http://localhost:8080/api/get-annotations/{inspectionId}` returns the feedback log (model detections + user edits) in JSON for archival or reporting.

## Key API Endpoints
- `GET /api/transformers` – list all transformers.
- `POST /api/transformers` – create a transformer (body: `TransformerReq`).
- `PUT /api/transformers/{transformerNo}` – update metadata/star state.
- `DELETE /api/transformers/{transformerNo}` – remove a transformer.
- `POST /api/upload_baseline_transformer` – upload baseline image (multipart).
- `GET /api/transformers/{id}/baseline` – fetch baseline URL + metadata.
- `POST /api/transformers/{no}/inspections` – create an inspection.
- `POST /api/upload-thermal-image` – upload maintenance thermal image with weather + uploader metadata.
- `POST /api/analyze-thermal-image` – run AI detection (multipart file + transformerId + inspectionId).
- `POST /api/save-annotations` / `GET /api/get-annotations/{inspectionId}` – persist and read annotations.
- `POST /api/retrain/export-dataset` – generate training dataset from accepted annotations.
- `GET /api/get-inspection-table` – tabular inspection summary for dashboard widgets.
