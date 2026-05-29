# LINE Login — Implementation Plan

## Credentials
```
LINE_CHANNEL_ID=2010174410
LINE_CHANNEL_SECRET=680484ea448135330b685f5a2b4ddfa6
```

## Flow: LINE Login บนเว็บ

```
User กด "Login with LINE"
    ↓
Redirect ไป LINE Login page
  https://access.line.me/oauth2/v2.1/authorize?
    response_type=code
    &client_id=2010174410
    &redirect_uri=http://localhost:3001/auth/line/callback
    &scope=profile%20openid%20email
    &state=random
    ↓
User login LINE + ยินยอม
    ↓
LINE redirect กลับมา
  http://localhost:3001/auth/line/callback?code=xxx&state=xxx
    ↓
Frontend ส่ง code ไป Go API
  POST /api/v1/auth/line { code: "xxx" }
    ↓
Go API:
  1. แลก code → access_token (POST https://api.line.me/oauth2/v2.1/token)
  2. ดึง profile (GET https://api.line.me/v2/profile)
  3. หา user by lineUserId — ถ้าไม่มีสร้างใหม่
  4. สร้าง JWT token
  5. return { accessToken, refreshToken, user }
    ↓
Frontend เก็บ JWT ใน auth store → login สำเร็จ
```

## สิ่งที่ต้องทำ

### Go API
1. เพิ่ม `lineUserId` field ใน User model
2. สร้าง handler: POST /api/v1/auth/line
3. LINE OAuth: แลก code → token → profile
4. Auto-create user ถ้ายังไม่มี (ไม่ต้อง register)
5. Return JWT เหมือน login ปกติ

### Frontend (fraud-web)
1. ปุ่ม "Login with LINE" ใน LoginModal
2. หน้า /auth/line/callback — รับ code จาก LINE แล้วส่ง Go API
3. ลบ Register form (ไม่ต้อง สมัครผ่าน LINE เลย)

### LINE Developers Console
1. ตั้ง Callback URL: http://localhost:3001/auth/line/callback
2. Production: https://yourdomain.com/auth/line/callback

## ต้องทำก่อน
- [x] LINE Login Channel (มีแล้ว)
- [x] Channel ID + Secret (มีแล้ว)
- [ ] ตั้ง Callback URL ใน LINE Console
- [ ] Go API: auth/line endpoint
- [ ] Frontend: LINE Login button + callback page
