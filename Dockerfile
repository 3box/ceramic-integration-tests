FROM node:current-alpine as builder

COPY package*.json ./

RUN apk add --no-cache python3 make g++

RUN npm ci --ignore-scripts
RUN npm rebuild bcrypto
RUN npm rebuild loady

FROM node:current-alpine as app

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder node_modules ./node_modules

COPY package*.json jest.config.js babel.config.js tsconfig.json ci/* ./
COPY config ./config
COPY src ./src

RUN npm run build

RUN npm run build:submodules

# NODE_ENV must match desired config file to use for tests
ENV NODE_ENV="internal-external"

CMD [ "./ci.sh" ]
