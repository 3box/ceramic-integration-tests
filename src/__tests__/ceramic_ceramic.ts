/**
 * @jest-environment ./build/index.js
 */

import { config } from 'node-config-ts';
import { CeramicApi, DoctypeUtils } from "@ceramicnetwork/common"
import { registerChangeListener } from "../utils";

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

const updatesAreShared = async(ceramic1, ceramic2): Promise<void> => {
    const content0 = { state: 0 }
    const content1 = { state: 1 }
    const content2 = { state: 2 }

    // Create initial doc
    console.log("about to create a doc!")
    const doc1 = await ceramic1.createDocument('tile', {content: content0})

    // Perform an update
    await doc1.change({content: content1})
    expect(doc1.content).toEqual(content1)
    expect(doc1.state.log.length).toEqual(2)

    // Load doc from other node, make sure it sees the update
    const doc2 = await ceramic2.loadDocument(doc1.id)
    expect(doc2.content).toEqual(doc1.content)

    // Now do an update from the second node, and make sure the first gets it
    const onUpdate = registerChangeListener(doc1)
    await doc2.change({content: content2})
    await onUpdate

    expect(doc2.content).toEqual(content2)
    expect(doc1.content).toEqual(content2)
}

describe('Ceramic<->Ceramic multi-node integration', () => {
    jest.setTimeout(1000 * 60 * 15) // 15 minutes

    test("create with one, load with the other", async () => {
        console.log("Running test 'create with one, load with the other'")
        await createWithOneLoadWithTheOther(ceramic, ceramic2)

        if (config.rerunWithCeramicsSwapped) {
            console.log("Re-running test 'create with one, load with the other' with ceramics swapped")
            await createWithOneLoadWithTheOther(ceramic2, ceramic)
        }
    })

    test("updates are shared", async () => {
        console.log("Running test 'updates are shared'")
        await updatesAreShared(ceramic, ceramic2)

        if (config.rerunWithCeramicsSwapped) {
            console.log("Re-running test 'updates are shared' with ceramics swapped")
            await updatesAreShared(ceramic2, ceramic)
        }
    })

})
