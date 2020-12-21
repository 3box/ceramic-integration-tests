import {assert, Services, Test} from "../index";
import { TileDoctype } from "@ceramicnetwork/doctype-tile"
import { AnchorStatus } from "@ceramicnetwork/common"

async function delay(mills: number): Promise<void> {
    await new Promise(resolve => setTimeout(() => resolve(), mills))
}

const TEST_TIMEOUT_MS = 1000 * 60 * 5 // 5 minutes

const registerChangeListener = function (doc: any): Promise<void> {
    return new Promise(resolve => {
        doc.on('change', () => {
            resolve()
        })
    })
}

export class CeramicCasTest extends Test {
    async _runTest(services: Services): Promise<void> {
        const {ceramic} = services

        // Test document creation
        const initialContent = { foo: 'bar' }
        const doc = await ceramic.createDocument<TileDoctype>('tile',
            {content: initialContent})

        assert.eq(doc.content.toString(), initialContent.toString())

        // Test document creation is anchored correctly
        const onCreateAnchor = registerChangeListener(doc)
        assert.eq(doc.state.anchorStatus, AnchorStatus.PENDING)
        await onCreateAnchor
        assert.eq(doc.state.anchorStatus, AnchorStatus.ANCHORED)

        // Test document update
        const newContent = { bar: 'baz'}
        const onUpdateAnchor = registerChangeListener(doc)

        await doc.change(newContent)
        assert.eq(doc.content.toString(), newContent.toString())

        // Test document update is anchored correctly
        assert.eq(doc.state.anchorStatus, AnchorStatus.PENDING)
        await onUpdateAnchor
        assert.eq(doc.state.anchorStatus, AnchorStatus.ANCHORED)
    }

    _getTestTimeout(): number {
        return TEST_TIMEOUT_MS
    }
}