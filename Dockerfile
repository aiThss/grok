# Ghim phiên bản upstream ổn định. Chỉ cập nhật sau khi đã thử nghiệm ở staging.
ARG OPEN_WEBUI_VERSION=v0.11.0
FROM ghcr.io/open-webui/open-webui:${OPEN_WEBUI_VERSION}

EXPOSE 8080
