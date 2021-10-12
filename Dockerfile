FROM node:14-alpine as builder

COPY package*.json ./

RUN apk add --no-cache python3 make g++

RUN npm ci --ignore-scripts
RUN npm rebuild bcrypto
RUN npm rebuild loady

FROM node:14-alpine as app

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder node_modules ./node_modules

COPY package*.json jest.config.js babel.config.js tsconfig.json ci/* ./
COPY config ./config
COPY src ./src

RUN npm run build

# NODE_ENV must match desired config file to use for tests
ENV NODE_ENV="private-public"
ENV AWS_REGION=${AWS_REGION}
ENV AWS_ECS_CLUSTER=${AWS_ECS_CLUSTER}
ENV AWS_ECS_FAMILY=${AWS_ECS_FAMILY}

# Discord notifications about running ECS tasks
ENV CLOUDWATCH_LOG_BASE_URL=${CLOUDWATCH_LOG_BASE_URL}
ENV DISCORD_WEBHOOK_URL_TEST_FAILURES=${DISCORD_WEBHOOK_URL_TEST_FAILURES}
ENV DISCORD_WEBHOOK_URL_TEST_RESULTS=${DISCORD_WEBHOOK_URL_TEST_RESULTS}

CMD [ "./ci.sh" ]
