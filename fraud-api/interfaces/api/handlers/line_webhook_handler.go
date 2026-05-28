package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"

	"github.com/gofiber/fiber/v2"

	"fraud-api/domain/services"
	"fraud-api/pkg/logger"
)

type LineWebhookHandler struct {
	lineBotService services.LineBotService
	channelSecret  string
}

func NewLineWebhookHandler(lineBotService services.LineBotService, channelSecret string) *LineWebhookHandler {
	return &LineWebhookHandler{
		lineBotService: lineBotService,
		channelSecret:  channelSecret,
	}
}

// lineWebhookEvent — LINE webhook event structure
type lineWebhookEvent struct {
	Type       string `json:"type"`
	ReplyToken string `json:"replyToken"`
	Source     struct {
		UserID string `json:"userId"`
		Type   string `json:"type"`
	} `json:"source"`
	Message *struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"message"`
	Postback *struct {
		Data string `json:"data"`
	} `json:"postback"`
}

type lineWebhookBody struct {
	Events []lineWebhookEvent `json:"events"`
}

// HandleWebhook POST /bot/line-webhook
func (h *LineWebhookHandler) HandleWebhook(c *fiber.Ctx) error {
	ctx := c.UserContext()
	body := c.Body()

	// 1. Verify signature
	signature := c.Get("X-Line-Signature")
	if !h.verifySignature(body, signature) {
		logger.WarnContext(ctx, "LINE webhook invalid signature")
		return c.SendStatus(400)
	}

	// 2. Parse events
	var webhook lineWebhookBody
	if err := json.Unmarshal(body, &webhook); err != nil {
		logger.WarnContext(ctx, "LINE webhook parse failed", "error", err)
		return c.SendStatus(400)
	}

	// 3. Process events async (return 200 ทันที)
	for _, event := range webhook.Events {
		evt := event
		go h.processEvent(context.Background(), evt)
	}

	return c.SendStatus(200)
}

func (h *LineWebhookHandler) processEvent(ctx context.Context, event lineWebhookEvent) {
	defer func() {
		if r := recover(); r != nil {
			logger.Error("LINE webhook panic", "error", r, "event_type", event.Type)
		}
	}()

	userID := event.Source.UserID
	if userID == "" {
		return
	}

	switch event.Type {
	case "follow":
		if err := h.lineBotService.HandleFollow(ctx, userID, event.ReplyToken); err != nil {
			logger.WarnContext(ctx, "HandleFollow failed", "error", err)
		}

	case "postback":
		if event.Postback != nil {
			if err := h.lineBotService.HandlePostback(ctx, userID, event.ReplyToken, event.Postback.Data); err != nil {
				logger.WarnContext(ctx, "HandlePostback failed", "error", err)
			}
		}

	case "message":
		if event.Message == nil {
			return
		}
		switch event.Message.Type {
		case "text":
			if err := h.lineBotService.HandleTextMessage(ctx, userID, event.ReplyToken, event.Message.Text); err != nil {
				logger.WarnContext(ctx, "HandleTextMessage failed", "error", err)
			}
		case "image":
			if err := h.lineBotService.HandleImageMessage(ctx, userID, event.ReplyToken); err != nil {
				logger.WarnContext(ctx, "HandleImageMessage failed", "error", err)
			}
		}
	}
}

func (h *LineWebhookHandler) verifySignature(body []byte, signature string) bool {
	if signature == "" || h.channelSecret == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(h.channelSecret))
	mac.Write(body)
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}
