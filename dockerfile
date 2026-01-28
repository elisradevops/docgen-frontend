# stage1 as builder
FROM node:22-slim as builder
WORKDIR /react-ui

# copy the package.json and package-lock.json to install dependencies
COPY package*.json ./

# Install dependencies (prefer ci, fall back to install if lockfile is out of sync)
RUN npm ci || npm install

# Copy application sources
COPY . .

# Build configuration
ENV GENERATE_SOURCEMAP=false
ENV NODE_ENV=production

# Allow build-time API base URL injection (for VSIX builds)
ARG VITE_DOCGEN_API_URL
ENV VITE_DOCGEN_API_URL=${VITE_DOCGEN_API_URL}

# Build the project
# Azure AD config will be injected at runtime by nginx entrypoint
RUN npm run build

FROM nginx:alpine
## Remove default nginx index page
RUN rm -rf /usr/share/nginx/html/*
RUN apk add --no-cache nodejs npm file \
  && npm install -g tfx-cli
# Copy Vite build output from stage 1
COPY --from=builder /react-ui/dist /usr/share/nginx/html
COPY --from=builder /react-ui/ado-extension/vss-extension.json /opt/ado-extension/vss-extension.json
COPY --from=builder /react-ui/ado-extension/dist /opt/ado-extension/dist
COPY --from=builder /react-ui/src/deployment /tmp/deployment
EXPOSE 80
ENTRYPOINT ["/bin/sh","/tmp/deployment/env-uri-init.sh"]
