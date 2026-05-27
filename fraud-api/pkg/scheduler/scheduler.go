package scheduler

import (
	"context"
	"fmt"
	"time"

	"github.com/robfig/cron/v3"
	"gorm.io/gorm"

	"fraud-api/domain/models"
	"fraud-api/domain/ports"
	"fraud-api/pkg/logger"
)

// Start สร้าง cron scheduler และเริ่มทำงาน
func Start(db *gorm.DB, notifier ports.NotificationPort) *cron.Cron {
	loc, _ := time.LoadLocation("Asia/Bangkok")
	c := cron.New(cron.WithLocation(loc))

	// ทุก 1 ชม. — expire subscriptions ที่หมดอายุ
	c.AddFunc("@every 1h", func() {
		expireSubscriptions(db, notifier)
	})

	// ทุกวัน 09:00 เวลาไทย — notify ก่อนหมดอายุ 3 วัน
	c.AddFunc("0 9 * * *", func() {
		notifyExpiringSubscriptions(db, notifier)
	})

	// รัน expire ทันทีตอน start
	go expireSubscriptions(db, notifier)

	c.Start()
	logger.Info("Scheduler started", "timezone", "Asia/Bangkok",
		"jobs", "expire @every 1h, notify_expiring @daily 09:00")
	return c
}

// expireSubscriptions อัปเดต status เป็น expired สำหรับ subscription ที่หมดอายุ
func expireSubscriptions(db *gorm.DB, notifier ports.NotificationPort) {
	ctx := context.Background()

	var expiring []models.Subscription
	db.WithContext(ctx).Preload("User").Preload("Plan").
		Where("status = ? AND end_date < NOW()", models.SubscriptionActive).
		Find(&expiring)

	if len(expiring) == 0 {
		return
	}

	result := db.WithContext(ctx).Model(&models.Subscription{}).
		Where("status = ? AND end_date < NOW()", models.SubscriptionActive).
		Update("status", models.SubscriptionExpired)

	logger.Info("Subscriptions expired", "count", result.RowsAffected)

	for _, sub := range expiring {
		notifier.Send(ctx, &ports.NotificationMessage{
			UserID:  sub.UserID,
			Title:   "สมาชิกหมดอายุ",
			Body:    "สมาชิก " + sub.Plan.Name + " ของคุณหมดอายุแล้ว กดต่ออายุได้ที่เว็บไซต์",
			Channel: "line_push",
			Data:    map[string]string{"action": "renew", "planId": sub.PlanID.String()},
		})
		logger.Info("Expired notification sent", "user_id", sub.UserID, "plan", sub.Plan.Name)
	}
}

// notifyExpiringSubscriptions แจ้งเตือน user ที่ subscription จะหมดอายุใน 3 วัน
func notifyExpiringSubscriptions(db *gorm.DB, notifier ports.NotificationPort) {
	ctx := context.Background()

	loc, _ := time.LoadLocation("Asia/Bangkok")
	now := time.Now().In(loc)
	threeDaysLater := now.AddDate(0, 0, 3)

	var expiring []models.Subscription
	db.WithContext(ctx).Preload("User").Preload("Plan").
		Where("status = ? AND end_date > ? AND end_date <= ?",
			models.SubscriptionActive, now, threeDaysLater).
		Find(&expiring)

	if len(expiring) == 0 {
		return
	}

	logger.Info("Expiring subscriptions found", "count", len(expiring))

	for _, sub := range expiring {
		daysLeft := int(sub.EndDate.Sub(now).Hours() / 24)
		if daysLeft < 1 {
			daysLeft = 1
		}

		notifier.Send(ctx, &ports.NotificationMessage{
			UserID:  sub.UserID,
			Title:   "สมาชิกใกล้หมดอายุ",
			Body:    fmt.Sprintf("สมาชิก %s จะหมดอายุใน %d วัน กดต่ออายุได้เลย", sub.Plan.Name, daysLeft),
			Channel: "line_push",
			Data:    map[string]string{"action": "renew", "daysLeft": fmt.Sprintf("%d", daysLeft)},
		})
		logger.Info("Expiring notification sent", "user_id", sub.UserID, "days_left", daysLeft)
	}
}
