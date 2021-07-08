import {
    AnchorStatus,
    CeramicApi,
    StreamUtils,
    IpfsApi,
    LogLevel,
    LoggerProvider,
    StreamState,
    Stream,
} from '@ceramicnetwork/common'
import {S3StateStore} from '@ceramicnetwork/cli'
import Ceramic, {CeramicConfig} from '@ceramicnetwork/core'
import CeramicClient from '@ceramicnetwork/http-client'

import dagJose from 'dag-jose'
import { convert } from 'blockcodec-to-ipld-format'
import {randomBytes} from '@stablelib/random'
import { Ed25519Provider } from 'key-did-provider-ed25519'
import KeyDidResolver from 'key-did-resolver'
import { DID } from 'dids'
import ipfsClient from 'ipfs-http-client'
import {config} from 'node-config-ts'
import { filter, take } from 'rxjs/operators'

const seed = randomBytes(32)

// 15 minutes for anchors to happen and be noticed (including potential failures and retries)
export const ANCHOR_TIMEOUT = 60 * 15

async function delay(millseconds: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(() => resolve(), millseconds))
}

async function withTimeout(prom: Promise<any>, timeoutSecs) {
    const startTime = new Date().toISOString()
    return new Promise(async (resolve, reject) => {
        setTimeout(() => {
            const curTime = new Date().toISOString()
            reject(`Timed out after ${timeoutSecs} seconds. Current time: ${curTime}, start time: ${startTime}`);
        }, timeoutSecs * 1000);
        resolve(await prom);
    });
}

const defaultMsgGenerator = function(stream) {
    const curTime = new Date().toISOString()
    return `Waiting for stream ${stream.id.toString()} to hit a specific stream state. Current time: ${curTime}. Current stream state: ${JSON.stringify(StreamUtils.serializeState(stream.state))}`
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
export async function waitForCondition(stream: Stream, condition: (stream: StreamState) => boolean, timeoutSecs: number, msgGenerator?: (stream: Stream) => string): Promise<void> {
    const waiter = stream.pipe(
        filter((state: StreamState) => {
            if (condition(state)) {
                return true
            }
            const msg = msgGenerator ? msgGenerator(stream) : defaultMsgGenerator(stream)
            console.debug(msg)
            return false
        }),
        take(1),
    ).toPromise()

    if (!condition(stream.state)) {
        // Only wait if condition isn't already true
        await withTimeout(waiter, timeoutSecs)
    }

    console.debug(`Stream ${stream.id.toString()} successfully reached desired state. Current stream state: ${JSON.stringify(StreamUtils.serializeState(stream.state))}`)
}

export async function waitForAnchor(stream: any, timeoutSecs: number = ANCHOR_TIMEOUT): Promise<void> {
    const msgGenerator = function(stream) {
        const curTime = new Date().toISOString()
        return `Waiting for stream ${stream.id.toString()} to be anchored. Current time: ${curTime}. Current stream state: ${JSON.stringify(StreamUtils.serializeState(stream.state))}`
    }
    await waitForCondition(stream, function(state) { return state.anchorStatus == AnchorStatus.ANCHORED}, timeoutSecs, msgGenerator)
}

export async function buildIpfs(configObj): Promise<any> {
    const dagJoseFormat = convert(dagJose)
    if (configObj.mode == "client") {
        console.log(`Creating IPFS via http client, connected to ${configObj.apiURL}`)
        return ipfsClient.create({ url: configObj.apiURL, ipld: { formats: [dagJoseFormat] } })
    } else if (configObj.mode == "node") {
        throw new Error("Creating in-process IPFS node is not currently supported")
    } else if (configObj.mode == "none") {
        return null
    } else {
        throw new Error(`IPFS mode "${configObj.mode}" not supported`)
    }
}

export async function buildCeramic (configObj, ipfs?: IpfsApi): Promise<CeramicApi> {
    let ceramic
    if (configObj.mode == "client") {
        console.log(`Creating ceramic via http client, connected to ${configObj.apiURL}`)
        ceramic = new CeramicClient(configObj.apiURL, { syncInterval: 500 })
        console.log(`Ceramic client connected successfully to ${configObj.apiURL}`)
    } else if (configObj.mode == "node") {
        console.log("Creating ceramic local node")
        const loggerProvider = new LoggerProvider({ logLevel: LogLevel.debug })
        const ceramicConfig: CeramicConfig = {
            networkName: configObj.network,
            ethereumRpcUrl: configObj.ethereumRpc,
            anchorServiceUrl: configObj.anchorServiceAPI,
            loggerProvider,
        }
        const [modules, params] = await Ceramic._processConfig(ipfs, ceramicConfig)
        if (configObj.s3StateStoreBucketName) {
            const s3StateStore = new S3StateStore(configObj.s3StateStoreBucketName)
            modules.pinStoreFactory.setStateStore(s3StateStore)
        }
        ceramic = new Ceramic(modules, params)
        await ceramic._init(true, true)
        console.log(`Ceramic local node started successfully`)
    } else if (configObj.mode == "none") {
        return null
    } else {
        throw new Error(`Ceramic mode "${configObj.mode}" not supported`)
    }

    const provider = new Ed25519Provider(seed)
    const resolver = KeyDidResolver.getResolver();
    const did = new DID({ provider, resolver })
    await ceramic.setDID(did)
    await did.authenticate()

    return ceramic
}

/**
 * Restarts the `ceramic` node, and reinstalls it into the `global` object.  Note that only
 * restarting `ceramic` is supported, restarting `ceramicClient` is not.  This is because
 * `ceramicClient` is always expected to be in `client` mode.
 */
export async function restartCeramic(): Promise<void> {
    if (config.jest.services.ceramic.mode == "client") {
        throw new Error("Cannot restart ceramic node running in http client mode")
    }
    await ceramic.close()
    await delay(3000) // Give some time for things to fully shut down before restarting

    ceramic = null
    ceramic = await buildCeramic(config.jest.services.ceramic, ipfs).catch((error) => {
        console.error(error)
        throw error
    })
}