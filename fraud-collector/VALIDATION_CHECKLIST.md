# Pipeline Checklist — ทั้งหมด

## Phase 1: Entity Validation ✅ DONE
- [x] normalize_phone (+66→0, 10 หลัก)
- [x] normalize_id_card (13 หลัก + checksum)
- [x] normalize_bank_account (10-15 หลัก)
- [x] invalid ≠ delete, เก็บ reason
- [x] ทดสอบ 198 posts: 50 valid, 14 invalid

## Phase 2: Confidence Score ✅ DONE
- [x] SOURCE_WEIGHTS dict config (image_caption=0.25)
- [x] score = llm × source × validation + clamp [0,1]
- [x] confidence_score ทุก entity

## Phase 3: Verification State ✅ DONE
- [x] 4 tiers: verified / metadata / weak_signal / invalid
- [x] verification_reason ทุก row
- [x] post_author = metadata (ไม่ใช่ verified)
- [x] image_caption = weak_signal (FB caption ≠ OCR จริง)

## Phase 4: DB Schema + Ingest ✅ DONE
- [x] 5 tables: social_groups/posts/persons/searchable_entities/collection_runs
- [x] entity_id deterministic hash (upsert safe)
- [x] pipeline_run_id (trace + rollback)
- [x] normalized_value nullable
- [x] partial indexes + trigram
- [x] Migration + ingest 675 entities สำเร็จ

## Phase 5: Search API ← ถัดไป
- [ ] Go Fiber endpoint: `GET /social/search?q=...`
- [ ] Query searchable_entities (verified default)
- [ ] Response: matches[] with verification_state + reason (POLICY: ห้าม aggregate ทิ้ง)
- [ ] แยก section: Verified / Metadata / Weak Signal
- [ ] Aggregate กับ frauds table (verified reports) ที่มีอยู่แล้ว
- [ ] Frontend badge: ✅ verified / ℹ️ metadata / ⚠️ weak_signal

## Phase 6: Media Enrichment (async, ไม่ block)
- [ ] SigLIP classify: id_card / face_photo / other
- [ ] PaddleOCR: อ่าน id_card จริง (แทน FB caption)
- [ ] RetinaFace + InsightFace: face detect + embedding → pgvector
- [ ] entity จาก OCR → verification_state = "verified" + reason = "ocr_confirmed"

## Phase 7: Entity Resolution
- [ ] Cross-post merge: คนเดียวกันหลายโพส (soft merge)
- [ ] Hybrid scoring: hard signals (id_card, phone) + soft signals (name, face)
- [ ] entity_profiles + entity_relations tables

## Phase 8: Scale
- [ ] 100+ groups: Job queue + Account pool
- [ ] PARTITION BY group_id
- [ ] 10,000 groups: Cloud storage + Monitoring
