package utils

import (
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"
)

var (
	slugSeparator  = regexp.MustCompile(`[\s_/\\]+`)
	slugNonAllowed = regexp.MustCompile(`[^\p{L}\p{M}\p{N}\-]+`)
	slugMultiDash  = regexp.MustCompile(`-{2,}`)
)

// GenerateSlug สร้าง URL-friendly slug จาก text
// รองรับภาษาไทยและภาษาอังกฤษ
func GenerateSlug(text string) string {
	s := strings.TrimSpace(text)
	s = strings.ToLower(s)

	// แทน space/underscore/slash ด้วย dash
	s = slugSeparator.ReplaceAllString(s, "-")

	// ลบอักขระพิเศษ (เก็บ letters, numbers, dash)
	s = slugNonAllowed.ReplaceAllString(s, "")

	// ลด dash ซ้ำ
	s = slugMultiDash.ReplaceAllString(s, "-")

	// ตัด dash หัว-ท้าย
	s = strings.Trim(s, "-")

	// ถ้าว่าง ใช้ timestamp
	if s == "" {
		s = fmt.Sprintf("article-%d", time.Now().Unix())
	}

	// จำกัดความยาว 200 chars (ตัดตรง dash)
	if len([]rune(s)) > 200 {
		runes := []rune(s)[:200]
		s = string(runes)
		if last := strings.LastIndex(s, "-"); last > 100 {
			s = s[:last]
		}
	}

	return s
}

// IsASCIISlug เช็คว่า slug เป็น ASCII-only (สำหรับ SEO-friendly English slug)
func IsASCIISlug(s string) bool {
	for _, r := range s {
		if r > unicode.MaxASCII {
			return false
		}
	}
	return true
}
