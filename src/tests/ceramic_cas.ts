import {assert, Services, Test} from "../index";
import { TileDoctype } from "@ceramicnetwork/doctype-tile"
import { AnchorStatus } from "@ceramicnetwork/common"

const TEST_TIMEOUT_MS = 1000 * 60 * 5 // 5 minutes

const registerChangeListener = function (doc: any): Promise<void> {
    return new Promise(resolve => {
        doc.on('change', () => {
            resolve()
        })
    })
}

/**
 * Tests basic integration between a single ceramic node and the anchor service.
 */
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

        assert.eq(doc.state.log.length, 4)
    }

    _getTestTimeout(): number {
        return TEST_TIMEOUT_MS
    }
}