package utils

import (
	"encoding/json"
	"math"
)

// Satang — เก็บเงินเป็นสตางค์ (int64) ป้องกัน precision loss
// API JSON: auto convert baht (float) <-> satang (int64)
// DB: เก็บเป็น BIGINT (satang)
type Satang int64

// BahtToSatang — แปลง baht (float) เป็น satang (int64)
func BahtToSatang(baht float64) Satang {
	return Satang(math.Round(baht * 100))
}

// ToBaht — แปลง satang เป็น baht (float)
func (s Satang) ToBaht() float64 {
	return float64(s) / 100
}

// MarshalJSON — Response: satang -> baht (float)
func (s Satang) MarshalJSON() ([]byte, error) {
	return json.Marshal(float64(s) / 100)
}

// UnmarshalJSON — Request: baht (float) -> satang
func (s *Satang) UnmarshalJSON(data []byte) error {
	var baht float64
	if err := json.Unmarshal(data, &baht); err != nil {
		return err
	}
	*s = Satang(math.Round(baht * 100))
	return nil
}
