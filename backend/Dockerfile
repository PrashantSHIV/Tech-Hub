FROM golang:1.22-alpine AS base
WORKDIR /app
RUN apk add --no-cache git ca-certificates

FROM base AS dev
RUN go install github.com/air-verse/air@latest
COPY go.mod go.sum ./
RUN go mod download
COPY . .
EXPOSE 8080
CMD ["air", "-c", ".air.toml"]

FROM base AS builder
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /out/server .

FROM alpine:3.20 AS prod
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=builder /out/server ./server
EXPOSE 8080
CMD ["./server"]

