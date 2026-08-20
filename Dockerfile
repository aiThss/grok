# Pin a stable upstream release. Update deliberately after testing in staging.
ARG OPEN_WEBUI_VERSION=v0.11.0
FROM ghcr.io/open-webui/open-webui:${OPEN_WEBUI_VERSION}

EXPOSE 8080
