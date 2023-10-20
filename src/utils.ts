import {
  AnchorStatus,
  CeramicApi,
  StreamUtils,
  IpfsApi,
  LogLevel,
  LoggerProvider,
  StreamState,
  Stream
} from '@ceramicnetwork/common'
import { S3Store } from '@ceramicnetwork/cli'
import { Ceramic, CeramicConfig } from '@ceramicnetwork/core'
import { CeramicClient } from '@ceramicnetwork/http-client'

import { randomString } from '@stablelib/random'
import { Ed25519Provider } from 'key-did-provider-ed25519'
import KeyDidResolver from 'key-did-resolver'
import { DID } from 'dids'
import * as ipfsClient from 'ipfs-http-client'
import { config } from 'node-config-ts'
import { filter, take } from 'rxjs/operators'
import { StreamID } from '@ceramicnetwork/streamid'
import { Model } from '@ceramicnetwork/stream-model'
import tmp from 'tmp-promise'
import * as sha256 from '@stablelib/sha256'
import * as uint8arrays from 'uint8arrays'
import AWS from 'aws-sdk'

const S3_DIRECTORY_NAME = process.env.S3_DIRECTORY_NAME ? `/${process.env.S3_DIRECTORY_NAME}` : ''

const seed = process.env.CERAMIC_NODE_PRIVATE_SEED_URL
  ? parseSeedUrl(process.env.CERAMIC_NODE_PRIVATE_SEED_URL)
  : randomString(32)

function parseSeedUrl(seedUrl: string): string {
  const url = new URL(seedUrl)
  if (url.protocol != 'inplace:' || url.pathname != 'ed25519') {
    throw Error('Unsupported url format for seed. Must be `inplace:ed25519#seed`.')
  }
  return url.hash.slice(1)
}

export async function createDid(seed?: string): Promise<DID> {
  if (!seed) {
    seed = randomString(32)
  }
  const digest = sha256.hash(uint8arrays.fromString(seed))
  const provider = new Ed25519Provider(digest)
  const resolver = KeyDidResolver.getResolver()
  const did = new DID({ provider, resolver })
  await did.authenticate()
  console.log('Authenticated did', did.id)

  return did
}

// 30 minutes for anchors to happen and be noticed (including potential failures and retries)
export const ANCHOR_TIMEOUT = 60 * 30

export async function delay(millseconds: number): Promise<void> {
  await new Promise<void>(resolve => setTimeout(() => resolve(), millseconds))
}

async function withTimeout(prom: Promise<any>, timeoutSecs) {
  const startTime = new Date().toISOString()
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const curTime = new Date().toISOString()
      reject(
        `Timed out after ${timeoutSecs} seconds. Current time: ${curTime}, start time: ${startTime}`
      )
    }, timeoutSecs * 1000)
    prom.then(resolve)
  })
}

const defaultMsgGenerator = function(stream) {
  const curTime = new Date().toISOString()
  return `Waiting for stream ${stream.id.toString()} to hit a specific stream state. Current time: ${curTime}. Current stream state: ${JSON.stringify(
    StreamUtils.serializeState(stream.state)
  )}`
}

/**
 * Waits for 'timeoutSecs' for the given 'condition' to evaluate to try when applied to the current
 * stream state for 'stream'.
 * @param stream
 * @param condition
 * @param timeoutSecs
 * @param msgGenerator - Function that takes a stream and returns a string to log every time
 *   a new state is found that *doesn't* satisfy 'condition'
 */
export async function waitForCondition(
  stream: Stream,
  condition: (stream: StreamState) => boolean,
  timeoutSecs: number,
  msgGenerator?: (stream: Stream) => string
): Promise<void> {
  const waiter = stream
    .pipe(
      filter((state: StreamState) => {
        if (condition(state)) {
          return true
        }
        const msg = msgGenerator ? msgGenerator(stream) : defaultMsgGenerator(stream)
        console.debug(msg)
        return false
      }),
      take(1)
    )
    .toPromise()

  if (!condition(stream.state)) {
    // Only wait if condition isn't already true
    await withTimeout(waiter, timeoutSecs)
  }

  console.debug(
    `Stream ${stream.id.toString()} successfully reached desired state. Current stream state: ${JSON.stringify(
      StreamUtils.serializeState(stream.state)
    )}`
  )
}

export async function waitForAnchor(
  stream: any,
  timeoutSecs: number = ANCHOR_TIMEOUT
): Promise<void> {
  const msgGenerator = function(stream) {
    const curTime = new Date().toISOString()
    return `Waiting for stream ${stream.id.toString()} to be anchored. Current time: ${curTime}. Current stream state: ${JSON.stringify(
      StreamUtils.serializeState(stream.state)
    )}`
  }
  await waitForCondition(
    stream,
    function(state) {
      return state.anchorStatus == AnchorStatus.ANCHORED
    },
    timeoutSecs,
    msgGenerator
  )
}

export async function buildIpfs(configObj): Promise<any> {
  if (configObj.mode == 'client') {
    console.log(`Creating IPFS via http client, connected to ${configObj.apiURL}`)
    return ipfsClient.create({ url: configObj.apiURL })
  } else if (configObj.mode == 'node') {
    throw new Error('Creating in-process IPFS node is not currently supported')
  } else if (configObj.mode == 'none') {
    return null
  } else {
    throw new Error(`IPFS mode "${configObj.mode}" not supported`)
  }
}

export async function buildCeramic(configObj, ipfs?: IpfsApi): Promise<CeramicApi> {
  const modelsToIndex = [
    Model.MODEL,
    ...config.jest.models.map(modelId => StreamID.fromString(modelId))
  ]

  if (configObj.mode == 'client') {
    console.log(`Creating ceramic via http client, connected to ${configObj.apiURL}`)

    const ceramic = new CeramicClient(configObj.apiURL, { syncInterval: 500 })

    if (configObj.adminSeed) {
      const adminDid = await createDid(configObj.adminSeed)
      ceramic.did = adminDid
      await ceramic.admin.startIndexingModels(modelsToIndex)
    }

    const did = await createDid(seed)
    ceramic.did = did

    console.log(`Ceramic client connected successfully to ${configObj.apiURL}`)
    return ceramic
  } else if (configObj.mode == 'node') {
    console.log('Creating ceramic local node')

    process.env.CERAMIC_ENABLE_EXPERIMENTAL_COMPOSE_DB = 'true'
    const loggerProvider = new LoggerProvider({ logLevel: LogLevel.debug })
    const indexingDirectory = await tmp.dir({ unsafeCleanup: true })

    const ceramicConfig: CeramicConfig = {
      networkName: configObj.network,
      ethereumRpcUrl: configObj.ethereumRpc,
      anchorServiceUrl: configObj.anchorServiceAPI,
      anchorServiceAuthMethod: 'did',
      loggerProvider,
      indexing: {
        db: `sqlite://${indexingDirectory.path}/ceramic.sqlite`,
        allowQueriesBeforeHistoricalSync: true,
        disableComposedb: false
      },
      pubsubTopic: configObj.pubsubTopic || undefined
    }
    const [modules, params] = await Ceramic._processConfig(ipfs, ceramicConfig)
    const ceramic = new Ceramic(modules, params)
    const did = await createDid(seed)
    ceramic.did = did
    if (configObj.s3StateStoreBucketName) {
      // When using localstack we need to allow path-style requests as it does not support virtual-hosted–style requests
      // This will not affect tests not using localstack as they are using a custom s3 endpoint
      AWS.config.update({
        s3ForcePathStyle: true
      })
      const bucketName = `${configObj.s3StateStoreBucketName}${S3_DIRECTORY_NAME}`
      const s3Store = new S3Store(configObj.network, bucketName, process.env.S3_ENDPOINT_URL)
      await ceramic.repository.injectKeyValueStore(s3Store)
    }

    await ceramic._init(true)
    await ceramic.index.indexModels(modelsToIndex)

    console.log(`Ceramic local node started successfully`)
    return ceramic
  } else if (configObj.mode == 'none') {
    return null
  }

  throw new Error(`Ceramic mode "${configObj.mode}" not supported`)
}

/**
 * Restarts the `ceramic` node, and reinstalls it into the `global` object.  Note that only
 * restarting `ceramic` is supported, restarting `ceramicClient` is not.  This is because
 * `ceramicClient` is always expected to be in `client` mode.
 */
export async function restartCeramic(): Promise<void> {
  if (config.jest.services.ceramic.mode == 'client') {
    throw new Error('Cannot restart ceramic node running in http client mode')
  }
  console.log('Restarting Ceramic node')
  await ceramic.close()
  await delay(3000) // Give some time for things to fully shut down before restarting

  ceramic = null
  ceramic = await buildCeramic(config.jest.services.ceramic, ipfs).catch(error => {
    console.error(error)
    throw error
  })

  await delay(3000) // Give some time for things to fully start up before continuing
  console.log('Ceramic node restarted')
}
