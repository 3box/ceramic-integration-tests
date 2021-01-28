/**
 * @jest-environment ./build/index.js
 */

import {config} from 'node-config-ts';
import {AnchorStatus, CeramicApi, DoctypeUtils} from "@ceramicnetwork/common"

declare global {
    const ceramic: CeramicApi;
    const ceramic2: CeramicApi;
}

async function delay(mills: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(() => resolve(), mills))
}

const registerChangeListener = function (doc: any): Promise<void> {
    return new Promise(resolve => {
        doc.on('change', () => {
            resolve()
        })
    })
}

const waitForAnchor = async (doc: any): Promise<void> => {
    let onAnchorStatusChange = registerChangeListener(doc)

    while (doc.state.anchorStatus == AnchorStatus.NOT_REQUESTED ||
    doc.state.anchorStatus == AnchorStatus.PENDING ||
    doc.state.anchorStatus == AnchorStatus.PROCESSING) {
        console.log(`Waiting for anchor of document ${doc.id.toString()}, current status: ${AnchorStatus[doc.state.anchorStatus]}. Anchor scheduled at ${doc.state.anchorScheduledFor?.toString()}`)
        await onAnchorStatusChange
        onAnchorStatusChange = registerChangeListener(doc)
    }
    console.log(`anchor status reached for document ${doc.id.toString()}`)
    expect(doc.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
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

    // Create initial doc state and wait for it to be anchored
    console.log("about to create a doc!")
    const doc1 = await ceramic1.createDocument('tile', {content: content0})

    await doc1.change({content: content1})

    expect(doc1.content).toEqual(content1)
    expect(doc1.state.log.length).toEqual(2)

    console.log("doc updated!")
    console.log("docId", doc1.id.toString())
    console.log("genesis cid", doc1.state.log[0].cid.toString())
    console.log("update cid", doc1.state.log[1].cid.toString())

    await waitForAnchor(doc1)
    console.log("Anchored!!! anchor CID:", doc1.state.log[2].cid.toString())
    while(true) {
        await delay(500)
    }






    // await waitForAnchor(doc1)
    // expect(doc1.content).toEqual(content1)
    // expect(doc1.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
    // expect(doc1.state.log.length).toEqual(3)
    // const doc2 = await ceramic2.loadDocument(doc1.id)
    // expect(doc2.content).toEqual(doc1.content)


    //const doc2 = await ceramic2.loadDocument(doc1.id)
    // await waitForAnchor(doc2)
    // expect(DoctypeUtils.serializeState(doc2.state)).toEqual(DoctypeUtils.serializeState(doc1.state))

    // Now perform updates and make sure they get shared between nodes
    // const onDoc2ReceivesUpdate = registerChangeListener(doc2)
    // doc1.change({content: content1})
    // await onDoc2ReceivesUpdate
    // expect(doc2.content).toEqual(content1)

    // todo: the other direction
    //doc2.change({content: content1})
}

describe('Ceramic<->Ceramic multi-node integration', () => {
    jest.setTimeout(1000 * 60 * 15) // 15 minutes

    test.only("create with one, load with the other", async () => {
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
            //console.log("Re-running test 'updates are shared' with ceramics swapped")
            //await updatesAreShared(ceramic2, ceramic)
        }
    })

})
