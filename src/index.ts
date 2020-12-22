import { CeramicApi, IpfsApi } from '@ceramicnetwork/common';
import Ceramic from '@ceramicnetwork/core';
import CeramicClient from '@ceramicnetwork/http-client';
import { config } from 'node-config-ts';
import { Ed25519Provider } from 'key-did-provider-ed25519'
import * as u8a from 'uint8arrays'
import multiformats from 'multiformats/basics'
import legacy from 'multiformats/legacy'
import dagJose from 'dag-jose'
import ipfsClient from "ipfs-http-client"

const seed = u8a.fromString('6e34b2e1a9624113d81ece8a8a22e6e97f0e145c25c1d4d2d0e62753b4060c83', 'base16')

/**
 * The group of handles to services that tests might interact with
 */
export interface Services {
    ceramic: CeramicApi,
    ipfs: IpfsApi,
}

export const buildServicesFromConfig = async (): Promise<Services> => {
    let ipfs: IpfsApi
    if (config.ipfs.mode == "http") {
        multiformats.multicodec.add(dagJose)
        const format = legacy(multiformats, dagJose.name)
        ipfs = ipfsClient({ url: config.ipfs.apiURL, ipld: { formats: [format] } })
    } else if (config.ipfs.mode != "none") {
        throw new Error(`IPFS mode "${config.ipfs.mode}" not supported`)
    }


    let ceramic: CeramicApi
    if (config.ceramic.mode == "http") {
        ceramic = new CeramicClient(config.ceramic.apiURL, { docSyncEnabled: true, docSyncInterval: 500 })
    } else if (config.ceramic.mode == "core") {
        const ceramicConfig = { anchorServiceURL: config.ceramic.anchorServiceURL, network: config.ceramic.network }
        ceramic = await Ceramic.create(ipfs, ceramicConfig)
        // TODO
        throw new Error ("not supported yet")
    } else {
        throw new Error(`Ceramic mode "${config.ceramic.mode}" not supported`)
    }

    const didProvider = new Ed25519Provider(seed)
    await ceramic.setDIDProvider(didProvider)

    return { ceramic, ipfs }
}
