import {assert, Services, Test} from "../index";
import { TileDoctype } from "@ceramicnetwork/doctype-tile"

async function delay(mills: number): Promise<void> {
    await new Promise(resolve => setTimeout(() => resolve(), mills))
}

const TEST_TIMEOUT_MS = 1000 * 5 // 5 seconds

export class CeramicCasTest extends Test {
    async _runTest(services: Services): Promise<void> {
        const {ceramic} = services

        const initialContent = { foo: 'bar' }
        const doc = await ceramic.createDocument<TileDoctype>('tile',
            {content: initialContent})

        assert.eq(doc.content.toString(), initialContent.toString())

        while(true) {
            await delay(1000)
        }
    }

    _getTestTimeout(): number {
        return TEST_TIMEOUT_MS
    }
}