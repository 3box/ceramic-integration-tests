import { CeramicApi, IpfsApi } from '@ceramicnetwork/common';
import { config } from 'node-config-ts';

import { default as jestEnvironmentNode } from 'jest-environment-node';
const NodeEnvironment = (jestEnvironmentNode as any).default;
import {buildCeramic, buildIpfs, delay} from './utils.js';

// Global services that are set up once and then available in all integration tests
declare global {
    let ceramic: CeramicApi
    const ceramicClient: CeramicApi
    const ipfs: IpfsApi
}

export default class IntegrationTestEnvironment extends NodeEnvironment {
    async setup() {
        console.log("Setting up integration test")
        await super.setup();

        try {
            await this.buildServicesFromConfig();

            await this.cleanStateStoreIfPrivate(); 

        } catch (e) {
            console.error("Building services failed", e.toString())
            process.exit(1)
        }
    }

    async teardown() {
        console.log("Tearing down integration test")

        // @ts-ignore
        await this.cleanStateStoreIfPrivate();

        // @ts-ignore
        await this.global.ceramic.close();
        this.global.ceramic = null

        // @ts-ignore
        await this.global.ceramicClient.close();
        this.global.ceramicClient = null

        // @ts-ignore
        this.global.ipfs = null

        await delay(3000) // Give some time for things to fully shut down

        await super.teardown()
    }

    private async buildServicesFromConfig() {
        console.info(`Starting test in environment: ${process.env.NODE_ENV}`)

        if (config.jest.services.ceramicClient.mode == "node") {
            throw new Error("Mode 'node' isn't supported for 'ceramicClient'")
        }

        console.info(`The ceramic configuration for this test is ${JSON.stringify(config.jest.services.ceramic)}`)

        const ipfs = await buildIpfs(config.jest.services.ipfs)
        const ceramic = await buildCeramic(config.jest.services.ceramic, ipfs)
        const ceramicClient = await buildCeramic(config.jest.services.ceramicClient)

        await delay(3000) // Give some time for things to fully start up before continuing

        this.global.ceramic = ceramic
        this.global.ceramicClient = ceramicClient
        this.global.ipfs = ipfs
    }

    private async cleanStateStoreIfPrivate() {
        console.info(`checking on state store in environment ${process.env.NODE_ENV}`)
        const bucket_name = config.jest.services.ceramic.s3StateStoreBucketName

        if ( ! bucket_name ) {
            console.info("Nothing to do")
            return
        }

        const parts = bucket_name.split("/", 2)

        if ( ! parts[0].includes('test')) {
            console.info(`NOT tearing down state store bucket ${bucket_name} doesn't look like a test bucket`)
            return
        }
 
        // clean up using ceramic node IF we are configured to use private node test bucket
        if (process.env.NODE_ENV == 'local_node-private') {

            console.info("This is the private node, cleaning up state store")

            // clean up pinstore
            const pins = await this.global.ceramic.pin.ls()
            console.log(pins)
            for await (let pin_id of pins) {
                console.log("Removing pin: " + pin_id)
                await this.global.ceramic.pin.rm(pin_id)
            }
        }
}
