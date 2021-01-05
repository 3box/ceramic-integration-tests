/**
 * @jest-environment ./build/index.js
 */

import {Services} from "../index";
import {AnchorStatus, CeramicApi} from "@ceramicnetwork/common"

const registerChangeListener = function (doc: any): Promise<void> {
    return new Promise(resolve => {
        doc.on('change', () => {
            resolve()
        })
    })
}

const waitForAnchor = async (doc: any, onAnchorStatusChange: Promise<void>): Promise<void> => {
    await onAnchorStatusChange

    // Depending on timing we might see the anchor status change from PENDING to PROCESSING, or
    // go directly from PENDING to ANCHORED. If we do see it in PROCESSING, we should wait for
    // another event to signal that it has finished being anchored.
    if (doc.state.anchorStatus == AnchorStatus.PROCESSING) {
        onAnchorStatusChange = registerChangeListener(doc)
        await onAnchorStatusChange
    }
    expect(doc.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
}

describe('Ceramic<->CAS integration', () => {
    jest.setTimeout(1000 * 60 * 5) // 5 minutes
    let ceramic: CeramicApi

    beforeAll(async () => {
        const services: Services = global.services;
        ({ceramic} = services);
    });

    test("basic crud is anchored properly, single update per anchor batch", async () => {
        // Test document creation
        console.log("Creating document")
        const initialContent = { foo: 'bar' }
        const doc = await ceramic.createDocument('tile', {content: initialContent})
        expect(doc.content).toEqual(initialContent)

        // Test document creation is anchored correctly
        console.log("Waiting for anchor of genesis record")
        const onCreateAnchor = registerChangeListener(doc)
        expect(doc.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        expect(doc.state.log.length).toEqual(1)

        await waitForAnchor(doc, onCreateAnchor)
        expect(doc.state.log.length).toEqual(2)

        // Test document update
        console.log("Updating document")
        const newContent = { bar: 'baz'}
        await doc.change({content: newContent})
        expect(doc.content).toEqual(newContent)

        // Test document update is anchored correctly
        const onUpdateAnchor = registerChangeListener(doc)
        expect(doc.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        expect(doc.state.log.length).toEqual(3)

        console.log("Waiting for anchor of update")
        await waitForAnchor(doc, onUpdateAnchor)
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
        const onCreateAnchor1 = registerChangeListener(doc1)
        const onCreateAnchor2 = registerChangeListener(doc2)
        const onCreateAnchor3 = registerChangeListener(doc3)
        const onCreateAnchor4 = registerChangeListener(doc4)
        expect(doc1.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        expect(doc1.state.log.length).toEqual(1)
        expect(doc2.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        expect(doc2.state.log.length).toEqual(1)
        expect(doc3.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        expect(doc3.state.log.length).toEqual(1)
        expect(doc4.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        expect(doc4.state.log.length).toEqual(1)
        await waitForAnchor(doc1, onCreateAnchor1)
        await waitForAnchor(doc2, onCreateAnchor2)
        await waitForAnchor(doc3, onCreateAnchor3)
        await waitForAnchor(doc4, onCreateAnchor4)

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
        const onUpdateAnchor1 = registerChangeListener(doc1)
        const onUpdateAnchor2 = registerChangeListener(doc2)
        const onUpdateAnchor3 = registerChangeListener(doc3)
        const onUpdateAnchor4 = registerChangeListener(doc4)
        expect(doc1.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        expect(doc2.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        expect(doc3.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        expect(doc4.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        expect(doc1.state.log.length).toEqual(3)
        expect(doc2.state.log.length).toEqual(4)
        expect(doc3.state.log.length).toEqual(5)
        expect(doc4.state.log.length).toEqual(6)

        console.log("Waiting for anchor of updates")
        await waitForAnchor(doc1, onUpdateAnchor1)
        await waitForAnchor(doc2, onUpdateAnchor2)
        await waitForAnchor(doc3, onUpdateAnchor3)
        await waitForAnchor(doc4, onUpdateAnchor4)

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