package slip

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"fraud-api/domain/ports"
	"fraud-api/pkg/logger"
)

type SlipOKAdapter struct {
	branchID string
	apiKey   string
	client   *http.Client
}

func NewSlipOKAdapter(branchID, apiKey string) ports.SlipVerifyPort {
	return &SlipOKAdapter{
		branchID: branchID,
		apiKey:   apiKey,
		client:   &http.Client{Timeout: 15 * time.Second},
	}
}

// slipOKResponse — success case (HTTP 200)
type slipOKResponse struct {
	Success bool        `json:"success"`
	Data    *slipOKData `json:"data,omitempty"`
}

// slipOKErrorResponse — error case (HTTP 400/401)
type slipOKErrorResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    *slipOKData `json:"data,omitempty"`
}

type slipOKData struct {
	Success       bool        `json:"success"`
	Message       string      `json:"message"`
	TransRef      string      `json:"transRef"`
	SendingBank   string      `json:"sendingBank"`
	ReceivingBank string      `json:"receivingBank"`
	TransDate     string      `json:"transDate"`
	TransTime     string      `json:"transTime"`
	Sender        slipOKParty `json:"sender"`
	Receiver      slipOKParty `json:"receiver"`
	Amount        float64     `json:"amount"`
}

type slipOKParty struct {
	DisplayName string        `json:"displayName"`
	Name        string        `json:"name"`
	Proxy       slipOKProxy   `json:"proxy"`
	Account     slipOKAccount `json:"account"`
}

type slipOKProxy struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type slipOKAccount struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

// VerifySlip — ส่ง URL ของรูปสลิปไปตรวจ (ไม่ต้อง download/base64)
func (a *SlipOKAdapter) VerifySlip(ctx context.Context, imageURL string) (*ports.SlipInfo, error) {
	apiURL := fmt.Sprintf("https://api.slipok.com/api/line/apikey/%s", a.branchID)

	// ส่งเป็น JSON: url + log=false
	body, _ := json.Marshal(map[string]any{
		"url": imageURL,
		"log": false,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-authorization", a.apiKey)

	resp, err := a.client.Do(req)
	if err != nil {
		logger.ErrorContext(ctx, "SlipOK API call failed", "error", err)
		return nil, fmt.Errorf("slipok api error: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	logger.InfoContext(ctx, "SlipOK raw response", "status", resp.StatusCode, "body_len", len(respBody))

	// HTTP 200 = success
	if resp.StatusCode == 200 {
		var slipResp slipOKResponse
		if err := json.Unmarshal(respBody, &slipResp); err != nil {
			logger.ErrorContext(ctx, "SlipOK response parse error", "body", string(respBody))
			return nil, fmt.Errorf("parse response: %w", err)
		}

		if slipResp.Data == nil {
			return &ports.SlipInfo{IsValid: false, ErrorMessage: "ไม่พบข้อมูลสลิป"}, nil
		}

		data := slipResp.Data
		logger.InfoContext(ctx, "SlipOK verify success",
			"trans_ref", data.TransRef,
			"amount", data.Amount,
			"sender", data.Sender.DisplayName,
			"receiver", data.Receiver.DisplayName,
		)

		return &ports.SlipInfo{
			TransRef:     data.TransRef,
			Amount:       data.Amount,
			SenderName:   data.Sender.DisplayName,
			SenderBank:   data.SendingBank,
			ReceiverName: data.Receiver.DisplayName,
			ReceiverBank: data.ReceivingBank,
			TransDate:    data.TransDate,
			TransTime:    data.TransTime,
			IsValid:      true,
		}, nil
	}

	// HTTP 400/401 = error
	var errResp slipOKErrorResponse
	if err := json.Unmarshal(respBody, &errResp); err != nil {
		return &ports.SlipInfo{IsValid: false, ErrorMessage: fmt.Sprintf("SlipOK error (HTTP %d)", resp.StatusCode)}, nil
	}

	logger.WarnContext(ctx, "SlipOK verify failed", "code", errResp.Code, "message", errResp.Message)

	result := &ports.SlipInfo{
		IsValid:      false,
		ErrorMessage: errResp.Message,
	}

	if errResp.Data != nil {
		result.TransRef = errResp.Data.TransRef
		result.Amount = errResp.Data.Amount
		result.SenderName = errResp.Data.Sender.DisplayName
		result.ReceiverName = errResp.Data.Receiver.DisplayName
	}

	return result, nil
}

func (a *SlipOKAdapter) GetProviderName() string {
	return "slipok"
}
