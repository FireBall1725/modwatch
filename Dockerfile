# syntax=docker/dockerfile:1

# Web build. Static assets are the same on every architecture, so this runs once on the build platform.
FROM --platform=$BUILDPLATFORM node:24-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
ARG VERSION
RUN VERSION=${VERSION} npm run build

# Go build. Cross-compiles on the build platform rather than running the arm64 leg under QEMU.
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
COPY --from=web /src/internal/ui/dist ./internal/ui/dist
# Empty by default so a local build reports 0.0.0-dev instead of a made-up version.
ARG VERSION
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -trimpath \
    -ldflags="-s -w ${VERSION:+-X 'github.com/fireball1725/modwatch/internal/version.Version=${VERSION}'}" \
    -o /out/modwatch ./cmd/modwatch

# Runtime. Needs CA certificates to reach api.curseforge.com; the time zone database is compiled in.
FROM alpine:3.22
RUN apk add --no-cache ca-certificates \
 && adduser -D -H -u 65532 modwatch \
 && mkdir /data && chown 65532:65532 /data
COPY --from=build /out/modwatch /usr/local/bin/modwatch
USER 65532:65532
# With no DATABASE_URL set, Modwatch keeps a SQLite file in /data. Mount a volume there to keep it.
# Set DATABASE_URL to a postgres:// URL to use Postgres instead.
ENV DATABASE_URL=sqlite:///data/modwatch.db
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/modwatch"]
