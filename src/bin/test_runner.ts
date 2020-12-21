import { config } from 'node-config-ts';
import CeramicClient from '@ceramicnetwork/http-client';
import {Services, Test} from "../index";
import { Ed25519Provider } from 'key-did-provider-ed25519'
import * as u8a from 'uint8arrays'
import {CeramicCasTest} from "../tests/ceramic_cas";


const seed = u8a.fromString('6e34b2e1a9624113d81ece8a8a22e6e97f0e145c25c1d4d2d0e62753b4060c83', 'base16')

class TestRunner {
    services: Services
    tests: Test[]

    public async init(): Promise<void> {
        this.services = await this._buildServices()
        this.tests = await this._registerTests()
    }

    public async run(): Promise<void> {
        for (const test of this.tests) {
            await test.runTest(this.services)
        }
    }

    public async stop(): Promise<void> {
        const { ceramic } = this.services
        await ceramic.close()
    }

    private async _registerTests(): Promise<Test[]> {
        const ceramic_cas_test = new CeramicCasTest()
        return [ceramic_cas_test]
    }

    private async _buildServices(): Promise<Services> {
        let ceramic
        if (config.ceramic.mode == "http") {
            ceramic = new CeramicClient(config.ceramic.apiURL, { docSyncEnabled: true, docSyncInterval: 500 })
        } else if (config.ceramic.mode == "core") {
            // TODO
            throw new Error ("not supported yet")
        } else {
            throw new Error(`Ceramic mode "${config.ceramic.mode}" not supported`)
        }

        const didProvider = new Ed25519Provider(seed)
        ceramic.setDIDProvider(didProvider)
        await ceramic.context.did.authenticate() // TODO: Why is this necessary? setDIDProvider does this internally already!

        return {ceramic}
    }
}

(async () => {
    const testRunner = new TestRunner()
    await testRunner.init()
    await testRunner.run()
    await testRunner.stop()
})().catch((e) => {
    console.log(e)
    process.exit(1)
}).then(() => {
    console.log("Tests run successfully!")
    process.exit(0)
})