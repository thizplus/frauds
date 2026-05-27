# FraudChecker — Master Checklist

---

## Phase 1-2: Admin Panel ✅ ALL DONE
## Phase 3: Public Frontend ✅ ALL DONE

- [x] 3.1 ลบ Admin pages
- [x] 3.2 Go API: public plans + payments
- [x] 3.3 Membership UI (PlanCard + CheckoutModal + /pricing)
- [x] 3.4 Free vs Member view (mask/unmask + badge + CTA)
- [x] 3.5 LINE Login (ปุ่มเดียว ตัด email/password)
- [x] 3.6 LIFF (auto-login ใน LINE ไม่ต้องกดอะไร)
- [x] 3.7 Navbar เหมือนกันทุกหน้า
- [x] 3.8 Domain + Tunnel (xn--12cainl6g3mua5b.com)

---

## Bot Collector

| Phase | งาน | สถานะ |
|-------|------|-------|
| 1 | เก็บ raw data | ✅ DONE |
| 2 | Replayability | TODO |
| 2.5 | Entity Normalization | TODO |
| 3 | LLM Extraction | TODO |
| 4 | Confidence Pipeline | TODO |
| 5 | Scale | TODO |
| 6 | Entity Graph | อนาคต |

---

## ยังไม่ได้ทำ (ทำเมื่อต้องใช้)

- [ ] LINE OA Bot (reply message step-by-step)
- [ ] SlipVerifyPort + SlipOkAdapter
- [ ] Upload endpoint (StoragePort)
- [ ] MembershipMiddleware (เช็ค subscription จริง)
- [ ] Notifications (LINE/Telegram)
- [ ] CORS production (เปลี่ยนจาก * เป็น specific domains)
