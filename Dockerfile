FROM node:current-alpine as builder

COPY package*.json ./

RUN apk add --no-cache python make g++

RUN npm ci --ignore-scripts


FROM node:current-alpine as app

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder node_modules ./node_modules

COPY package*.json babel.config.js tsconfig.json ci/* ./
COPY config ./config
COPY src ./src

RUN npm run build

# NODE_ENV must match desired config file to use for tests
ENV NODE_ENV="dev-unstable"

CMD [ "./ci.sh" ]
