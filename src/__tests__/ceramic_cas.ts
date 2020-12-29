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
        console.log("Creating document")
        const initialContent = { foo: 'bar' }
        const doc = await ceramic.createDocument('tile', {content: initialContent})
        expect(doc.content).toEqual(initialContent)

        // Test document creation is anchored correctly
        console.log("Waiting for anchor of genesis record")
        const onCreateAnchor = registerChangeListener(doc)
        expect(doc.state.anchorStatus).toEqual(AnchorStatus.PENDING)
        expect(doc.state.log.length).toEqual(1)
        await onCreateAnchor

        expect(doc.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
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
        await onUpdateAnchor

        expect(doc.state.anchorStatus).toEqual(AnchorStatus.ANCHORED)
        expect(doc.content).toEqual(newContent)
        expect(doc.state.log.length).toEqual(4)
    })
})