import { CeramicApi, IpfsApi } from '@ceramicnetwork/common';
import CeramicClient from '@ceramicnetwork/http-client';
import { config } from 'node-config-ts';
import { Ed25519Provider } from 'key-did-provider-ed25519'
import ipfsClient from "ipfs-http-client"
import basicsImport from 'multiformats/cjs/src/basics-import.js'
import legacy from 'multiformats/cjs/src/legacy.js'
import dagJose from 'dag-jose'
import Ceramic, { CeramicConfig } from "@ceramicnetwork/core";
import { randomBytes } from '@stablelib/random'

const seed = randomBytes(32)

/**
 * The group of handles to services that tests might interact with
 */
export interface Services {
    ceramic: CeramicApi,
}

export const buildServicesFromConfig = async (): Promise<Services> => {
    let ceramic
    if (config.ceramic.mode == "client") {
        console.log("Creating ceramic via http client")
        ceramic = new CeramicClient(config.ceramic.apiURL, { docSyncEnabled: true, docSyncInterval: 500 })
    } else if (config.ceramic.mode == "node") {
        console.log("Creating ceramic via local node")
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
