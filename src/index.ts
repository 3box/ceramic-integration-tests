import { CeramicApi, IpfsApi } from '@ceramicnetwork/common';
import { config } from 'node-config-ts';

import NodeEnvironment from 'jest-environment-node'
import {buildCeramic, buildIpfs, delay} from './utils';

// Global services that are set up once and then available in all integration tests
declare global {
    let ceramic: CeramicApi
    const ceramicClient: CeramicApi
    const ipfs: IpfsApi
    const ipfs2: IpfsApi
}

export default class IntegrationTestEnvironment extends NodeEnvironment {
    async setup() {
        await super.setup();

        try {
            await this.buildServicesFromConfig();
        } catch (e) {
            console.error("Building services failed", e.toString())
            process.exit(1)
        }
    }

    async teardown() {
        // @ts-ignore
        await this.global.ceramic.close();
        this.global.ceramic = null

        // @ts-ignore
        await this.global.ceramicClient.close();
        this.global.ceramicClient = null

        this.global.ipfs = null

        await delay(3000) // Give some time for things to fully shut down

        await super.teardown()
    }

    private async buildServicesFromConfig() {
        console.info(`Starting test in environment: ${process.env.NODE_ENV}`)

        if (config.jest.services.ceramicClient.mode == "node") {
            throw new Error("Mode 'node' isn't supported for 'ceramicClient'")
        }

        const ipfs = await buildIpfs(config.jest.services.ipfs)
        const ceramic = await buildCeramic(config.jest.services.ceramic, ipfs)
        const ceramicClient = await buildCeramic(config.jest.services.ceramicClient)

        await delay(3000) // Give some time for things to fully start up before continuing

        this.global.ceramic = ceramic
        this.global.ceramicClient = ceramicClient
        this.global.ipfs = ipfs
    }
}
