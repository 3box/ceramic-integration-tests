import { CeramicApi, IpfsApi } from '@ceramicnetwork/common';
import { config } from 'node-config-ts';

import NodeEnvironment from 'jest-environment-node'
import { buildCeramic, buildIpfs } from './utils';

// Global services that are set up once and then available in all integration tests
declare global {
    let ceramic: CeramicApi
    const ceramic2: CeramicApi
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
        // @ts-ignore
        await this.global.ceramic2.close();

        await super.teardown()
    }

    private async buildServicesFromConfig() {
        const ipfs = await buildIpfs(config.services.ipfs)
        const ipfs2 = await buildIpfs(config.services.ipfs2)
        const ceramic = await buildCeramic(config.services.ceramic, ipfs)
        const ceramic2 = await buildCeramic(config.services.ceramic2, ipfs2)

        this.global.ceramic = ceramic
        this.global.ceramic2 = ceramic2
        this.global.ipfs = ipfs
        this.global.ipfs2 = ipfs2
    }
}
