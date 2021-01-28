/**
 * @jest-environment ./build/index.js
 */

import { CeramicApi, DoctypeUtils } from "@ceramicnetwork/common"
import { registerChangeListener, waitForAnchor } from "../utils";

declare global {
    const ceramic: CeramicApi;
    const ceramic2: CeramicApi;
}

async function delay(mills: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(() => resolve(), mills))
}

const createWithOneLoadWithTheOther = async(ceramic1, ceramic2): Promise<void> => {
    const content = { foo: 'bar' }
    const doc1 = await ceramic1.createDocument('tile', {content})
    const doc2 = await ceramic2.loadDocument(doc1.id)
    expect(doc1.content).toEqual(content)
    expect(doc2.content).toEqual(doc1.content)
}

const updatesAreShared = async(ceramic1: CeramicApi, ceramic2: CeramicApi, anchor: boolean): Promise<void> => {
    const content0 = { state: 0 }
    const content1 = { state: 1 }
    const content2 = { state: 2 }

    // Create initial doc
    console.log("Creating document on node 1")
    const doc1 = await ceramic1.createDocument('tile', {content: content0}, {anchor})
    if (anchor) {
        await waitForAnchor(doc1)
    }

    // Perform an update
    console.log("Updating document on node 1")
    await doc1.change({content: content1}, {anchor})
    if (anchor) {
        await waitForAnchor(doc1)
    }
    expect(doc1.content).toEqual(content1)

    // Load doc from other node, make sure it sees the update
    console.log("Loading document on node 2")
    const doc2 = await ceramic2.loadDocument(doc1.id)
    expect(doc2.content).toEqual(doc1.content)
    expect(DoctypeUtils.serializeState(doc2.state)).toEqual(DoctypeUtils.serializeState(doc1.state))

    // Now do an update from the second node, and make sure the first gets it
    console.log("Updating document on node 2")
    const onUpdate = registerChangeListener(doc1)
    await doc2.change({content: content2}, {anchor})

    console.log("Waiting for node 1 to learn of update from node 2")
    await onUpdate

    expect(doc2.content).toEqual(content2)
    expect(doc1.content).toEqual(content2)

    if (anchor) {
        await waitForAnchor(doc1)
        await waitForAnchor(doc2)
    }

    expect(doc2.content).toEqual(content2)
    expect(doc1.content).toEqual(content2)
    expect(DoctypeUtils.serializeState(doc1.state)).toEqual(DoctypeUtils.serializeState(doc2.state))
}

describe('Ceramic<->Ceramic multi-node integration', () => {
    jest.setTimeout(1000 * 60 * 15) // 15 minutes

    test("create with one, load with the other", async () => {
        console.info("Running test 'create with one, load with the other'")
        await createWithOneLoadWithTheOther(ceramic, ceramic2)
    })

    test("create with one, load with the other - ceramics swapped", async () => {
        console.info("Re-running test 'create with one, load with the other' with ceramics swapped")
        await createWithOneLoadWithTheOther(ceramic2, ceramic)
    })

    test("updates are shared without anchoring", async () => {
        console.info("Running test 'updates are shared without anchoring'")
        await updatesAreShared(ceramic, ceramic2, false)
    })

    test("updates are shared without anchoring - ceramics swapped", async () => {
        console.info("Re-running test 'updates are shared without anchoring' with ceramics swapped")
        await updatesAreShared(ceramic2, ceramic, false)
    })

    test("updates are shared with anchoring", async () => {
        console.log("Running test 'updates are shared with anchoring'")
        await updatesAreShared(ceramic, ceramic2, true)

    })

    test("updates are shared with anchoring - ceramics swapped", async () => {
        console.log("Re-running test 'updates are shared with anchoring' with ceramics swapped")
        await updatesAreShared(ceramic2, ceramic, true)
    })

})
