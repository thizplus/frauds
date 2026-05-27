package utils

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"time"
)

const refCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // ไม่มี I, O, 0, 1 กันสับสน

// GenerateRefCode สร้างรหัสอ้างอิง format: PREFIX-YYMMDD-XXXXXXXX
func GenerateRefCode(prefix string) string {
	now := time.Now()
	datePart := now.Format("060102") // YYMMDD

	randPart := make([]byte, 8)
	for i := range randPart {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(refCodeChars))))
		randPart[i] = refCodeChars[n.Int64()]
	}

	return fmt.Sprintf("%s-%s-%s", prefix, datePart, string(randPart))
}

// GenerateInviteCode สร้างรหัสเชิญ 10 ตัวอักษร (ไม่มี prefix)
func GenerateInviteCode() string {
	code := make([]byte, 10)
	for i := range code {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(refCodeChars))))
		code[i] = refCodeChars[n.Int64()]
	}
	return string(code)
}
