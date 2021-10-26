FROM node:14-alpine as builder

COPY package*.json ./

RUN apk add --no-cache python3 make g++

RUN npm ci --ignore-scripts
RUN npm rebuild bcrypto
RUN npm rebuild loady
RUN npm install node-jq

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
ENV CERAMIC_ECS_CLUSTERS="ceramic-dev ceramic-dev-ex"
ENV CERAMIC_URLS="https://ceramic-dev.3boxlabs.com https://gateway-dev.ceramic.network https://ceramic-private-dev.3boxlabs.com"

# Discord notifications about running ECS tasks
ENV APIGATEWAY_RESOURCE_ID=${APIGATEWAY_RESOURCE_ID}
ENV APIGATEWAY_RESTAPI_ID=${APIGATEWAY_RESTAPI_ID}
ENV CLOUDWATCH_LOG_BASE_URL=${CLOUDWATCH_LOG_BASE_URL}
ENV DISCORD_WEBHOOK_URL_TEST_FAILURES=${DISCORD_WEBHOOK_URL_TEST_FAILURES}
ENV DISCORD_WEBHOOK_URL_TEST_RESULTS=${DISCORD_WEBHOOK_URL_TEST_RESULTS}

CMD [ "./ci.sh" ]
