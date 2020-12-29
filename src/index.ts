import { CeramicApi, IpfsApi } from '@ceramicnetwork/common';
import CeramicClient from '@ceramicnetwork/http-client';
import { config } from 'node-config-ts';
import { Ed25519Provider } from 'key-did-provider-ed25519'
import * as u8a from 'uint8arrays'
import ipfsClient from "ipfs-http-client"
import basicsImport from 'multiformats/cjs/src/basics-import.js'
import legacy from 'multiformats/cjs/src/legacy.js'
import dagJose from 'dag-jose'
import Ceramic, { CeramicConfig } from "@ceramicnetwork/core";


const seed = u8a.fromString('6e34b2e1a9624113d81ece8a8a22e6e97f0e145c25c1d4d2d0e62753b4060c83', 'base16')

/**
 * The group of handles to services that tests might interact with
 */
export interface Services {
    ceramic: CeramicApi,
}

export const buildServicesFromConfig = async (): Promise<Services> => {
    let ceramic
    if (config.ceramic.mode == "http") {
        ceramic = new CeramicClient(config.ceramic.apiURL, { docSyncEnabled: true, docSyncInterval: 500 })
    } else if (config.ceramic.mode == "core") {
        basicsImport.multicodec.add(dagJose)
        const format = legacy(basicsImport, dagJose.name)

        const ipfs: IpfsApi = ipfsClient({url: config.ceramic.ipfsApi, ipld: { formats: [format] } })

        const ceramicConfig: CeramicConfig = {
            networkName: config.ceramic.network,
            ethereumRpcUrl: config.ceramic.ethereumRpc,
            anchorServiceUrl: config.ceramic.anchorServiceAPI,
        }
        ceramic = await Ceramic.create(ipfs, ceramicConfig)
    } else {
        throw new Error(`Ceramic mode "${config.ceramic.mode}" not supported`)
    }

    const didProvider = new Ed25519Provider(seed)
    await ceramic.setDIDProvider(didProvider)

    return {ceramic}
}
