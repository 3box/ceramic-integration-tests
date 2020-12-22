import {buildServicesFromConfig, Services} from "../index";
import {AnchorStatus, CeramicApi} from "@ceramicnetwork/common"

const registerChangeListener = function (doc: any): Promise<void> {
    return new Promise(resolve => {
        doc.on('change', () => {
            resolve()
        })
    })
}

describe('Ceramic<->CAS integration', () => {
    jest.setTimeout(1000 * 60 * 5) // 5 minutes
    let ceramic: CeramicApi

    beforeAll(async () => {
        const services: Services = await buildServicesFromConfig();
        ({ceramic} = services);
    });

    afterAll(async () => {
        await ceramic.close()
    });

    test("basic crud", async () => {
        expect(3).toEqual(3)

        // Test document creation
        const initialContent = { foo: 'bar' }
        const doc = await ceramic.createDocument('tile', {content: initialContent})

        expect(doc.content).toEqual(initialContent)
        console.log(JSON.stringify(doc.content))
        //
        // // Test document creation is anchored correctly
        // const onCreateAnchor = registerChangeListener(doc)
        // expect(doc.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        // //assert.eq(doc.state.log.length, 1)
        // await onCreateAnchor
        // expect(doc.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
        // //assert.eq(doc.state.log.length, 2)
        //
        // // Test document update
        // const newContent = { bar: 'baz'}
        // const onUpdateAnchor = registerChangeListener(doc)
        //
        // await doc.change(newContent)
        // expect(doc.content).toEqual(newContent.toString())
        //
        // // Test document update is anchored correctly
        // expect(doc.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        // //assert.eq(doc.state.log.length, 3)
        //
        // console.log("AAAAAA")
        // console.log(JSON.stringify(doc.state))
        //
        // await onUpdateAnchor
        // expect(doc.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
        //
        // console.log("BBBBB")
        // console.log(JSON.stringify(doc.state))
        // //assert.eq(doc.state.log.length, 4)
    })
})