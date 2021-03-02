import { AnchorStatus, CeramicApi, IpfsApi } from "@ceramicnetwork/common";
import { S3StateStore } from "@ceramicnetwork/cli";
import Ceramic, { CeramicConfig } from "@ceramicnetwork/core";
import CeramicClient from '@ceramicnetwork/http-client';

import tmp from 'tmp-promise'

import dagJose from 'dag-jose'
import { randomBytes } from '@stablelib/random'
import { Ed25519Provider } from 'key-did-provider-ed25519'
import ipfsClient from "ipfs-http-client"
import IPFS from "ipfs-core"
import { config } from 'node-config-ts';

//@ts-ignore
import multiformats from 'multiformats/basics'
// @ts-ignore
import legacy from 'multiformats/legacy'

const seed = randomBytes(32)

async function delay(millseconds: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(() => resolve(), millseconds))
}

export function registerChangeListener(doc: any): Promise<void> {
    return new Promise(resolve => {
        doc.on('change', () => {
            resolve()
        })
    })
}

export async function waitForAnchor(doc: any): Promise<void> {
    let onAnchorStatusChange = registerChangeListener(doc)

    while (doc.state.anchorStatus == AnchorStatus.NOT_REQUESTED ||
    doc.state.anchorStatus == AnchorStatus.PENDING ||
    doc.state.anchorStatus == AnchorStatus.PROCESSING) {
        console.log(`Waiting for anchor of document ${doc.id.toString()}, current status: ${AnchorStatus[doc.state.anchorStatus]}. Anchor scheduled at ${doc.state.anchorScheduledFor?.toString()}`)
        await onAnchorStatusChange
        onAnchorStatusChange = registerChangeListener(doc)
    }
    console.log(`anchor status reached for document ${doc.id.toString()}`)
    expect(doc.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
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
        ceramic = new CeramicClient(configObj.apiURL, { docSyncEnabled: true, docSyncInterval: 500 })
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

    const didProvider = new Ed25519Provider(seed)
    await ceramic.setDIDProvider(didProvider)

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