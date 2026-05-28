#!/bin/bash
# ===== LINE Rich Menu Setup Script =====
# สร้าง Rich Menu 2 ชุด (Free + Member) ผ่าน LINE API
# ต้องตั้ง LINE_CHANNEL_ACCESS_TOKEN ก่อนรัน

TOKEN="${LINE_CHANNEL_ACCESS_TOKEN:-8CE3HyICXrLB/Hq7+cwAHv3zc/AOuutkj7BKoBMfc9IuYokFaptvt6lA6GwTeuIwSqqHZ//gYajrbfxijIZ6eOkN0ZGmsaTCC5uY4CUyOVuBlGLE41jlLqWDwLvTiNguOs0IQMKmrbYSP9bmJKhh0QdB04t89/1O/w1cDnyilFU=}"
LIFF_URL="https://liff.line.me/2010174410-8ZWlb9uS"
SITE_URL="https://xn--12cainl6g3mua5b.com"
API="https://api.line.me/v2/bot"

if [ -z "$TOKEN" ]; then
  echo "ERROR: LINE_CHANNEL_ACCESS_TOKEN not set"
  exit 1
fi

echo "===== Creating Rich Menu A (Free) ====="
# Template: Large 2500x1686 — ซ้ายใหญ่ (A) + ขวาบน (B) + ขวาล่าง (C)
MENU_A=$(curl -s -X POST "$API/richmenu" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
  "size": {"width": 2500, "height": 1686},
  "selected": true,
  "name": "Free User Menu",
  "chatBarText": "เมนู",
  "areas": [
    {
      "bounds": {"x": 0, "y": 0, "width": 1666, "height": 1686},
      "action": {"type": "uri", "label": "เช็กคนโกง.com", "uri": "'"$LIFF_URL"'"}
    },
    {
      "bounds": {"x": 1666, "y": 0, "width": 834, "height": 843},
      "action": {"type": "postback", "label": "ค้นหา", "data": "action=search", "displayText": "🔍 ค้นหา"}
    },
    {
      "bounds": {"x": 1666, "y": 843, "width": 834, "height": 843},
      "action": {"type": "uri", "label": "อัพเกรด", "uri": "'"$SITE_URL"'/pricing"}
    }
  ]
}')

MENU_A_ID=$(echo "$MENU_A" | grep -o '"richMenuId":"[^"]*"' | cut -d'"' -f4)
echo "Menu A ID: $MENU_A_ID"

if [ -z "$MENU_A_ID" ]; then
  echo "ERROR: Failed to create Menu A"
  echo "$MENU_A"
  exit 1
fi

echo ""
echo "===== Creating Rich Menu B (Member) ====="
MENU_B=$(curl -s -X POST "$API/richmenu" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
  "size": {"width": 2500, "height": 1686},
  "selected": true,
  "name": "Member Menu",
  "chatBarText": "เมนู",
  "areas": [
    {
      "bounds": {"x": 0, "y": 0, "width": 1666, "height": 1686},
      "action": {"type": "uri", "label": "เช็กคนโกง.com", "uri": "'"$LIFF_URL"'"}
    },
    {
      "bounds": {"x": 1666, "y": 0, "width": 834, "height": 843},
      "action": {"type": "postback", "label": "ค้นหา", "data": "action=search", "displayText": "🔍 ค้นหา"}
    },
    {
      "bounds": {"x": 1666, "y": 843, "width": 834, "height": 843},
      "action": {"type": "uri", "label": "ระบบเก็บข้อมูล", "uri": "'"$SITE_URL"'/lender"}
    }
  ]
}')

MENU_B_ID=$(echo "$MENU_B" | grep -o '"richMenuId":"[^"]*"' | cut -d'"' -f4)
echo "Menu B ID: $MENU_B_ID"

if [ -z "$MENU_B_ID" ]; then
  echo "ERROR: Failed to create Menu B"
  echo "$MENU_B"
  exit 1
fi

echo ""
echo "===== Generating placeholder images ====="

# สร้างรูป placeholder ด้วย ImageMagick (ถ้ามี) หรือ download
# ถ้าไม่มี ImageMagick ต้องสร้างรูปเอง 2500x843px

generate_placeholder() {
  local FILE=$1
  local TEXT=$2
  if command -v convert &> /dev/null; then
    convert -size 2500x843 xc:'#0f172a' \
      -fill '#00d492' -pointsize 60 -gravity North -annotate +0+200 "🛡️ เช็กคนโกง.com" \
      -fill '#94a3b8' -pointsize 36 -gravity North -annotate +0+300 "ตรวจสอบประวัติคนโกงออนไลน์" \
      -fill '#1e293b' -draw "rectangle 0,543 2500,843" \
      -fill '#cbd5e1' -pointsize 30 -gravity SouthWest -annotate +200+100 "🔍 ค้นหา" \
      -fill '#cbd5e1' -pointsize 30 -gravity South -annotate +0+100 "$TEXT" \
      -fill '#cbd5e1' -pointsize 30 -gravity SouthEast -annotate +200+100 "❓ ช่วยเหลือ" \
      "$FILE"
    echo "Generated: $FILE"
  else
    echo "⚠️ ImageMagick not found — ต้องสร้างรูป $FILE (2500x843px) เอง"
    # สร้าง minimal PNG placeholder
    echo "สร้าง placeholder 1x1 pixel (ต้องเปลี่ยนรูปจริงทีหลัง)"
  fi
}

generate_placeholder "/tmp/richmenu_free.png" "👑 อัพเกรด"
generate_placeholder "/tmp/richmenu_member.png" "📋 ระบบเก็บข้อมูล"

echo ""
echo "===== Uploading images ====="

upload_image() {
  local MENU_ID=$1
  local FILE=$2

  if [ ! -f "$FILE" ]; then
    echo "⚠️ File not found: $FILE — ใช้ solid color แทน"
    # สร้าง minimal JPEG
    printf '\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00' > /tmp/minimal.jpg
    # Upload จะ fail แต่ menu ยังใช้ได้ (ไม่มีรูป)
    echo "⚠️ ข้ามการ upload — ต้อง upload รูปจริงทีหลัง"
    echo "   curl -X POST $API/richmenu/$MENU_ID/content -H 'Authorization: Bearer TOKEN' -H 'Content-Type: image/png' --data-binary @your_image.png"
    return
  fi

  RESULT=$(curl -s -X POST "$API/richmenu/$MENU_ID/content" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: image/png" \
    --data-binary "@$FILE")
  echo "Upload result for $MENU_ID: $RESULT"
}

upload_image "$MENU_A_ID" "/tmp/richmenu_free.png"
upload_image "$MENU_B_ID" "/tmp/richmenu_member.png"

echo ""
echo "===== Setting Menu A as default ====="
curl -s -X POST "$API/user/all/richmenu/$MENU_A_ID" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo ""
echo "===== DONE ====="
echo ""
echo "Rich Menu IDs (เก็บไว้ใน .env):"
echo "  LINE_RICH_MENU_FREE=$MENU_A_ID"
echo "  LINE_RICH_MENU_MEMBER=$MENU_B_ID"
echo ""
echo "ขั้นตอนถัดไป:"
echo "  1. เพิ่ม LINE_RICH_MENU_FREE + LINE_RICH_MENU_MEMBER ใน .env"
echo "  2. สร้างรูป Rich Menu จริง (2500x843px) แล้ว upload:"
echo "     curl -X POST $API/richmenu/MENU_ID/content -H 'Authorization: Bearer TOKEN' -H 'Content-Type: image/png' --data-binary @image.png"
echo "  3. ตั้ง Webhook URL ใน LINE Developers Console:"
echo "     https://api.xn--12cainl6g3mua5b.com/api/v1/bot/line-webhook"
echo "  4. ปิด Auto-reply messages ใน LINE OA Manager"
