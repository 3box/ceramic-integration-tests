import { config } from 'node-config-ts';


class TestRunner {
    public async run(): Promise<void> {
        console.log("AAA")

        console.log("config.ceramicMode: " + config.ceramicMode)

        console.log("BBB")
    }
}

const testRunner = new TestRunner()
testRunner.run().catch((e) => {
    console.log(e)
    process.exit(1)
})