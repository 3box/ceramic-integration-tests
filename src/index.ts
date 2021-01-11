import { CeramicApi, IpfsApi } from '@ceramicnetwork/common';
import CeramicClient from '@ceramicnetwork/http-client';
import { config } from 'node-config-ts';
import { Ed25519Provider } from 'key-did-provider-ed25519'
import ipfsClient from "ipfs-http-client"
//@ts-ignore
import multiformats from 'multiformats/basics'
// @ts-ignore
import legacy from 'multiformats/legacy'

import dagJose from 'dag-jose'
import Ceramic, { CeramicConfig } from "@ceramicnetwork/core";
import { randomBytes } from '@stablelib/random'
import NodeEnvironment from 'jest-environment-node'

const seed = randomBytes(32)

// Global services that are set up once and then available in all integration tests
declare global {
    const ceramic: CeramicApi
}

export default class IntegrationTestEnvironment extends NodeEnvironment {
    async setup() {
        await super.setup();

         await this.buildServicesFromConfig();
    }

    async teardown() {
        // @ts-ignore
        await this.global.ceramic.close();

        await super.teardown()
    }

    private async buildServicesFromConfig() {
        let ceramic
        if (config.ceramic.mode == "client") {
            console.log("Creating ceramic via http client")
            ceramic = new CeramicClient(config.ceramic.apiURL, { docSyncEnabled: true, docSyncInterval: 500 })
        } else if (config.ceramic.mode == "node") {
            console.log("Creating ceramic via local node")
            multiformats.multicodec.add(dagJose)
            const format = legacy(multiformats, dagJose.name)

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

        this.global.ceramic = ceramic
    }
}
