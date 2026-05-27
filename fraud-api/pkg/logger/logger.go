package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"

	"gopkg.in/natefinch/lumberjack.v2"
)

type Config struct {
	Level      string
	Format     string
	Output     string
	FilePath   string
	MaxSize    int
	MaxBackups int
	MaxAge     int
	Compress   bool
}

type contextKey string

const RequestIDKey contextKey = "request_id"

var defaultLogger *slog.Logger

func Init(cfg Config) error {
	level := parseLevel(cfg.Level)

	writers := []io.Writer{}

	if cfg.Output == "stdout" || cfg.Output == "both" {
		writers = append(writers, os.Stdout)
	}

	if cfg.Output == "file" || cfg.Output == "both" {
		dir := filepath.Dir(cfg.FilePath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}

		fileWriter := &lumberjack.Logger{
			Filename:   cfg.FilePath,
			MaxSize:    cfg.MaxSize,
			MaxBackups: cfg.MaxBackups,
			MaxAge:     cfg.MaxAge,
			Compress:   cfg.Compress,
		}
		writers = append(writers, fileWriter)
	}

	var writer io.Writer
	if len(writers) == 1 {
		writer = writers[0]
	} else {
		writer = io.MultiWriter(writers...)
	}

	var handler slog.Handler
	opts := &slog.HandlerOptions{Level: level}

	if cfg.Format == "json" {
		handler = slog.NewJSONHandler(writer, opts)
	} else {
		handler = slog.NewTextHandler(writer, opts)
	}

	defaultLogger = slog.New(handler)
	slog.SetDefault(defaultLogger)

	return nil
}

func parseLevel(level string) slog.Level {
	switch level {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func GetLogger() *slog.Logger {
	if defaultLogger == nil {
		return slog.Default()
	}
	return defaultLogger
}

func WithRequestID(ctx context.Context) *slog.Logger {
	l := GetLogger()
	if requestID, ok := ctx.Value(RequestIDKey).(string); ok {
		return l.With("request_id", requestID)
	}
	return l
}

func ContextWithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, RequestIDKey, requestID)
}

func GetRequestID(ctx context.Context) string {
	if requestID, ok := ctx.Value(RequestIDKey).(string); ok {
		return requestID
	}
	return ""
}

// Convenience functions

func Info(msg string, args ...any)  { GetLogger().Info(msg, args...) }
func Warn(msg string, args ...any)  { GetLogger().Warn(msg, args...) }
func Error(msg string, args ...any) { GetLogger().Error(msg, args...) }
func Debug(msg string, args ...any) { GetLogger().Debug(msg, args...) }

// Context-aware functions

func InfoContext(ctx context.Context, msg string, args ...any) {
	WithRequestID(ctx).Info(msg, args...)
}

func WarnContext(ctx context.Context, msg string, args ...any) {
	WithRequestID(ctx).Warn(msg, args...)
}

func ErrorContext(ctx context.Context, msg string, args ...any) {
	WithRequestID(ctx).Error(msg, args...)
}

func DebugContext(ctx context.Context, msg string, args ...any) {
	WithRequestID(ctx).Debug(msg, args...)
}
