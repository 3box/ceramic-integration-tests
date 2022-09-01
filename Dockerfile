FROM node:16-alpine as builder

COPY package*.json ./

RUN apk add --no-cache python3 make g++

RUN npm ci --ignore-scripts

ENV TARGET_ARCH="arm64"
RUN npm run postinstall -prefix ./node_modules/go-ipfs

RUN npm rebuild bcrypto
RUN npm rebuild loady
RUN npm rebuild node-jq

FROM node:16-alpine as app

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder node_modules ./node_modules

COPY package*.json jest.config.json babel.config.json tsconfig.json ci/* ./
COPY config ./config
COPY src ./src

RUN npm run build

# NODE_ENV must match desired config file to use for tests
ENV NODE_ENV="private-public"
ENV AWS_REGION=${AWS_REGION}
ENV AWS_ECS_CLUSTER=${AWS_ECS_CLUSTER}
ENV AWS_ECS_FAMILY=${AWS_ECS_FAMILY}
ENV CERAMIC_ECS_CLUSTERS="ceramic-qa ceramic-qa-ex"
ENV CERAMIC_URLS="https://ceramic-qa.3boxlabs.com https://gateway-qa.ceramic.network https://ceramic-private-qa.3boxlabs.com"

# Discord notifications about running ECS tasks
ENV APIGATEWAY_RESOURCE_ID=${APIGATEWAY_RESOURCE_ID}
ENV APIGATEWAY_RESTAPI_ID=${APIGATEWAY_RESTAPI_ID}
ENV CLOUDWATCH_LOG_BASE_URL=${CLOUDWATCH_LOG_BASE_URL}
ENV DISCORD_WEBHOOK_URL_TEST_FAILURES=${DISCORD_WEBHOOK_URL_TEST_FAILURES}
ENV DISCORD_WEBHOOK_URL_TEST_RESULTS=${DISCORD_WEBHOOK_URL_TEST_RESULTS}

CMD [ "./ci.sh" ]
