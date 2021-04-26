import {
    AnchorStatus,
    CeramicApi,
    StreamUtils,
    IpfsApi,
    StreamState,
    Stream
} from "@ceramicnetwork/common";
import {S3StateStore} from "@ceramicnetwork/cli";
import Ceramic, {CeramicConfig} from "@ceramicnetwork/core";
import CeramicClient from '@ceramicnetwork/http-client';

import dagJose from 'dag-jose'
import {randomBytes} from '@stablelib/random'
import { Ed25519Provider } from 'key-did-provider-ed25519'
import KeyDidResolver from 'key-did-resolver';
import { DID } from 'dids';
import ipfsClient from "ipfs-http-client"
import {config} from 'node-config-ts';
import { filter, take } from 'rxjs/operators';

//@ts-ignore
import multiformats from 'multiformats/basics'
// @ts-ignore
import legacy from 'multiformats/legacy'

const seed = randomBytes(32)

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

    if (condition(stream.state)) {
        // Handle case where condition is already true when waitForCondition gets called
        return
    }

    await withTimeout(waiter, timeoutSecs)
}

export async function waitForAnchor(stream: any, timeoutSecs: number): Promise<void> {
    const msgGenerator = function(stream) {
        const curTime = new Date().toISOString()
        return `Waiting for stream ${stream.id.toString()} to be anchored. Current time: ${curTime}. Current stream state: ${JSON.stringify(StreamUtils.serializeState(stream.state))}`
    }
    await waitForCondition(stream, function(state) { return state.anchorStatus == AnchorStatus.ANCHORED}, timeoutSecs, msgGenerator)
    console.log(`Stream ${stream.id.toString()} successfully anchored`)
}

export async function buildIpfs(configObj): Promise<IpfsApi> {
    multiformats.multicodec.add(dagJose)
    const format = legacy(multiformats, dagJose.name)
    if (configObj.mode == "client") {
        console.log(`Creating IPFS via http client, connected to ${configObj.apiURL}`)
        return ipfsClient({url: configObj.apiURL, ipld: {formats: [format]}})
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
    } else if (configObj.mode == "node") {
        console.log("Creating ceramic local node")
        const ceramicConfig: CeramicConfig = {
            networkName: configObj.network,
            ethereumRpcUrl: configObj.ethereumRpc,
            anchorServiceUrl: configObj.anchorServiceAPI,
        }
        const [modules, params] = await Ceramic._processConfig(ipfs, ceramicConfig)
        if (configObj.s3StateStoreBucketName) {
            const s3StateStore = new S3StateStore(configObj.s3StateStoreBucketName)
            modules.pinStoreFactory.setStateStore(s3StateStore)
        }
        ceramic = new Ceramic(modules, params)
        await ceramic._init(true, true)
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
export async function restartCeramic() {
    if (config.jest.services.ceramic.mode == "client") {
        throw new Error("Cannot restart ceramic node running in http client mode")
    }
    await ceramic.close()
    ceramic = null
    ceramic = await buildCeramic(config.jest.services.ceramic, ipfs)
}