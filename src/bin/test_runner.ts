import { config } from 'node-config-ts';
import CeramicClient from '@ceramicnetwork/http-client';
import {Services, Test} from "../index";
import { Ed25519Provider } from 'key-did-provider-ed25519'
import * as u8a from 'uint8arrays'
import {CeramicCasTest} from "../tests/ceramic_cas";


const seed = u8a.fromString('6e34b2e1a9624113d81ece8a8a22e6e97f0e145c25c1d4d2d0e62753b4060c83', 'base16')

class TestRunner {
    public async run(): Promise<void> {
        const services = await this._buildServices()
        const tests = await this._registerTests()
        await this._runTests(tests, services)
    }

    private async _registerTests(): Promise<Test[]> {
        const ceramic_cas_test = new CeramicCasTest()
        return [ceramic_cas_test]
    }

    private async _buildServices(): Promise<Services> {
        let ceramic
        if (config.ceramic.mode == "http") {
            ceramic = new CeramicClient(config.ceramic.apiURL)
        } else if (config.ceramic.mode == "core") {
            // TODO
            throw new Error ("not supported yet")
        } else {
            throw new Error(`Ceramic mode "${config.ceramic.mode}" not supported`)
        }

        const didProvider = new Ed25519Provider(seed)
        ceramic.setDIDProvider(didProvider)

        return {ceramic}
    }

    private async _runTests(tests: Test[], services: Services) {
        for (const test of tests) {
            await test.runTest(services)
        }
    }
}

const testRunner = new TestRunner()
testRunner.run().catch((e) => {
    console.log(e)
    process.exit(1)
}).then(() => {
    process.exit(0)
})