# syntax=docker/dockerfile:1@sha256:572cebbc2b15e6f84c077742952674889cb63cd5e9b80abdffcbe587b6f19183
FROM node:24-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/* \
  # Runtime never invokes npm/npx — drop them so their bundled deps
  # (undici, tar, etc.) don't show up as vulnerabilities in this image.
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./

USER node
EXPOSE 3000

# Leaves keep CMD; Docker runs: tini -- <CMD...>
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
