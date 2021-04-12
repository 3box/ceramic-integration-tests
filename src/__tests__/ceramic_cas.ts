/**
 * @jest-environment ./build/index.js
 */

import { AnchorStatus, CeramicApi } from "@ceramicnetwork/common"
import { waitForAnchor } from "../utils";

declare global {
    const ceramic: CeramicApi
}

// 15 minutes for anchors to happen and be noticed (including potential failures and retries)
const ANCHOR_TIMEOUT = 60 * 15

describe('Ceramic<->CAS basic integration', () => {
    jest.setTimeout(1000 * 60 * 30) // 30 minutes

    test("basic crud is anchored properly, single update per anchor batch", async () => {
        // Test document creation
        console.log("Creating document")
        const initialContent = { foo: 'bar' }
        const doc = await ceramic.createDocument('tile', {content: initialContent})
        expect(doc.content).toEqual(initialContent)

        // Test document creation is anchored correctly
        console.log("Waiting for anchor of genesis record")
        await waitForAnchor(doc, ANCHOR_TIMEOUT).catch(errStr => { throw new Error(errStr) })
        expect(doc.state.log.length).toEqual(2)

        // Test document update
        console.log("Updating document")
        const newContent = { bar: 'baz'}
        await doc.change({content: newContent})
        expect(doc.content).toEqual(newContent)

        // Test document update is anchored correctly
        console.log("Waiting for anchor of update")
        await waitForAnchor(doc, ANCHOR_TIMEOUT).catch(errStr => { throw new Error(errStr) })
        expect(doc.content).toEqual(newContent)
        expect(doc.state.log.length).toEqual(4)
    })

    test("multiple documents are anchored properly, multiple updates per anchor batch", async () => {
        const content0 = { state: 0 }
        const content1 = { state: 1 }
        const content2 = { state: 2 }
        const content3 = { state: 3 }
        const content4 = { state: 4 }

        // Create some documents
        console.log("Creating documents")
        const doc1 = await ceramic.createDocument('tile', {content: content0})
        const doc2 = await ceramic.createDocument('tile', {content: content0})
        const doc3 = await ceramic.createDocument('tile', {content: content0})
        const doc4 = await ceramic.createDocument('tile', {content: content0})
        expect(doc1.content).toEqual(content0)
        expect(doc2.content).toEqual(content0)
        expect(doc3.content).toEqual(content0)
        expect(doc4.content).toEqual(content0)

        // Test document creation is anchored correctly
        console.log("Waiting for anchor of genesis records")
        await waitForAnchor(doc1, ANCHOR_TIMEOUT).catch(errStr => { throw new Error(errStr) })
        await waitForAnchor(doc2, ANCHOR_TIMEOUT).catch(errStr => { throw new Error(errStr) })
        await waitForAnchor(doc3, ANCHOR_TIMEOUT).catch(errStr => { throw new Error(errStr) })
        await waitForAnchor(doc4, ANCHOR_TIMEOUT).catch(errStr => { throw new Error(errStr) })

        expect(doc1.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
        expect(doc1.state.log.length).toEqual(2)
        expect(doc2.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
        expect(doc2.state.log.length).toEqual(2)
        expect(doc3.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
        expect(doc3.state.log.length).toEqual(2)
        expect(doc4.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
        expect(doc4.state.log.length).toEqual(2)

        // Test that all 4 docs were anchored in the same transaction
        expect(doc2.state.anchorProof.blockNumber).toEqual(doc1.state.anchorProof.blockNumber)
        expect(doc2.state.anchorProof.txHash).toEqual(doc1.state.anchorProof.txHash)
        expect(doc3.state.anchorProof.txHash).toEqual(doc1.state.anchorProof.txHash)
        expect(doc4.state.anchorProof.txHash).toEqual(doc1.state.anchorProof.txHash)


        // Test document updates
        console.log("Updating documents")
        await doc1.change({content: content1}, {anchor: true})
        await doc2.change({content: content1}, {anchor: false})
        await doc3.change({content: content1}, {anchor: false})
        await doc4.change({content: content1}, {anchor: false})

        await doc2.change({content: content2}, {anchor: true})
        await doc3.change({content: content2}, {anchor: false})
        await doc4.change({content: content2}, {anchor: false})

        await doc3.change({content: content3}, {anchor: true})
        await doc4.change({content: content3}, {anchor: false})

        await doc4.change({content: content4}, {anchor: true})

        expect(doc1.content).toEqual(content1)
        expect(doc2.content).toEqual(content2)
        expect(doc3.content).toEqual(content3)
        expect(doc4.content).toEqual(content4)

        // Test document updates are anchored correctly
        console.log("Waiting for anchor of updates")
        await waitForAnchor(doc1, ANCHOR_TIMEOUT).catch(errStr => { throw new Error(errStr) })
        await waitForAnchor(doc2, ANCHOR_TIMEOUT).catch(errStr => { throw new Error(errStr) })
        await waitForAnchor(doc3, ANCHOR_TIMEOUT).catch(errStr => { throw new Error(errStr) })
        await waitForAnchor(doc4, ANCHOR_TIMEOUT).catch(errStr => { throw new Error(errStr) })

        expect(doc1.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
        expect(doc2.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
        expect(doc3.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
        expect(doc4.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
        expect(doc1.content).toEqual(content1)
        expect(doc2.content).toEqual(content2)
        expect(doc3.content).toEqual(content3)
        expect(doc4.content).toEqual(content4)
        expect(doc1.state.log.length).toEqual(4)
        expect(doc2.state.log.length).toEqual(5)
        expect(doc3.state.log.length).toEqual(6)
        expect(doc4.state.log.length).toEqual(7)

        // Test that all 4 docs were anchored in the same transaction
        expect(doc2.state.anchorProof.blockNumber).toEqual(doc1.state.anchorProof.blockNumber)
        expect(doc2.state.anchorProof.txHash).toEqual(doc1.state.anchorProof.txHash)
        expect(doc3.state.anchorProof.txHash).toEqual(doc1.state.anchorProof.txHash)
        expect(doc4.state.anchorProof.txHash).toEqual(doc1.state.anchorProof.txHash)
    })
})