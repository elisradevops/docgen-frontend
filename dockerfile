# stage1 as builder
FROM node:18-alpine as builder
WORKDIR /react-ui
# copy the package.json and package-lock.json to install dependencies
COPY package*.json ./
# Install dependencies (prefer ci, fall back to install if lockfile is out of sync)
RUN npm ci || npm install
COPY . .
# Build the project and copy the files
RUN npm run build

FROM nginx:alpine
## Remove default nginx index page
RUN rm -rf /usr/share/nginx/html/*
# Copy Vite build output from stage 1
COPY --from=builder /react-ui/dist /usr/share/nginx/html
COPY --from=builder /react-ui/src/deployment /tmp/deployment
EXPOSE 80
ENTRYPOINT ["/bin/sh","/tmp/deployment/env-uri-init.sh"]
