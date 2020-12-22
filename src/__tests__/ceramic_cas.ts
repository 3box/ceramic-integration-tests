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
        // Test document creation
        const initialContent = { foo: 'bar' }
        const doc = await ceramic.createDocument('tile', {content: initialContent})

        expect(doc.content).toEqual(initialContent)

        // Test document creation is anchored correctly
        const onCreateAnchor = registerChangeListener(doc)
        expect(doc.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        expect(doc.state.log.length).toEqual(1)
        await onCreateAnchor

        console.log("AAAAAA")
        console.log(JSON.stringify(doc.state, null, 2))
        expect(doc.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
        expect(doc.state.log.length).toEqual(2)

        // Test document update
        const newContent = { bar: 'baz'}
        const onUpdateAnchor = registerChangeListener(doc)

        await doc.change(newContent)
        //expect(doc.content).toEqual(newContent)

        // Test document update is anchored correctly
        expect(doc.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        //assert.eq(doc.state.log.length, 3)

        await onUpdateAnchor
        console.log("BBBBB")
        console.log(JSON.stringify(doc.state, null, 2))

        expect(doc.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
        expect(doc.content).toEqual(newContent)
        //assert.eq(doc.state.log.length, 4)
    })
})