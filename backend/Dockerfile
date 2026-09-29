# Multi-Stage Dockerfile for EarnMiniApp Go Backend

# Stage 1: Build
FROM golang:alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o server ./cmd/server/main.go

# Stage 2: Minimal Runtime Container
FROM alpine:3.19

WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata

COPY --from=builder /app/server .
COPY --from=builder /app/internal/db/schema.sql ./internal/db/schema.sql
COPY --from=builder /app/.env.example ./.env.example

EXPOSE 3000

CMD ["./server"]
