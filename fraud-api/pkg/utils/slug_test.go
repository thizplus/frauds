package utils

import "testing"

func TestGenerateSlug(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"Hello World", "hello-world"},
		{"  spaces  everywhere  ", "spaces-everywhere"},
		{"10 วิธีเช็คคนโกงออนไลน์ ก่อนโอนเงินให้ใคร", "10-วิธีเช็คคนโกงออนไลน์-ก่อนโอนเงินให้ใคร"},
		{"เบี้ยวหนี้เงินกู้", "เบี้ยวหนี้เงินกู้"},
		{"สวัสดี/ครับ", "สวัสดี-ครับ"},
		{"test---multi---dash", "test-multi-dash"},
		{"   ", ""},     // empty → timestamp fallback
		{"a/b\\c_d e", "a-b-c-d-e"},
		{"Special!@#$%chars", "specialchars"},
		{"café résumé", "café-résumé"},
	}

	for _, tt := range tests {
		got := GenerateSlug(tt.input)
		if tt.want == "" {
			// empty input → should get "article-XXXX"
			if got == "" || len(got) < 8 {
				t.Errorf("GenerateSlug(%q) = %q, want non-empty article-xxx", tt.input, got)
			}
			continue
		}
		if got != tt.want {
			t.Errorf("GenerateSlug(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestGenerateSlugThaiVowels(t *testing.T) {
	// สระไทยทุกตัวต้องไม่หาย
	cases := []struct {
		input string
		check string // substring ที่ต้องมีอยู่ใน slug
	}{
		{"สระอิ อี อึ อื", "สระอิ"},
		{"ตัวอย่าง", "ตัวอย่าง"},
		{"เงินกู้", "เงินกู้"},
		{"น้ำใจ", "น้ำใจ"},
		{"เบี้ยว", "เบี้ยว"},
		{"วิธีป้องกัน", "วิธีป้องกัน"},
	}

	for _, tt := range cases {
		got := GenerateSlug(tt.input)
		if !containsSubstring(got, tt.check) {
			t.Errorf("GenerateSlug(%q) = %q, missing %q", tt.input, got, tt.check)
		}
	}
}

func containsSubstring(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 || findSubstring(s, sub))
}

func findSubstring(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
