FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /bin/fraud-api cmd/api/main.go

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /bin/fraud-api .
COPY .env.example .env

RUN mkdir -p logs

EXPOSE 3000

CMD ["./fraud-api"]
