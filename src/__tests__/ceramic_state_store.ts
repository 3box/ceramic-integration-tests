/**
 * @jest-environment ./build/index.js
 */

import { CeramicApi } from "@ceramicnetwork/common";
import {DocID, DocRef} from "@ceramicnetwork/docid";
import { restartCeramic } from "../utils";
import { config } from "node-config-ts";

declare global {
    const ceramic: CeramicApi
}

const isPinned = async (ceramic: CeramicApi, docId: DocID): Promise<Boolean> => {
    const pinnedDocsIterator = await ceramic.pin.ls(docId)
    const pinnedDocIds = []
    for await (const id of pinnedDocsIterator) {
        pinnedDocIds.push(id)
    }
    return pinnedDocIds.includes(docId.toString())
}

describe('Ceramic state store tests', () => {
    jest.setTimeout(1000 * 60 * 5) // 5 minutes

    test("Unpinned doc state does not survive ceramic restart", async () => {
        if (config.services.ceramic.mode == "client") {
            console.warn("skipping test since 'ceramic' is in http-client mode")
            return
        }

        const initialContent = { foo: 'bar' }
        const doc = await ceramic.createDocument(
            'tile', {content: initialContent}, {anchor:false, publish:false})
        expect(doc.content).toEqual(initialContent)
        const newContent = { bar: 'baz'}
        await doc.change({content: newContent}, {anchor:false, publish:false})
        expect(doc.content).toEqual(newContent)

        expect(await isPinned(ceramic, doc.id)).toBeFalsy()
        await restartCeramic()

        const loaded = await ceramic.loadDocument(doc.id)
        expect(loaded.content).toEqual(initialContent)
    })

    test("Pinned doc state does survive ceramic restart", async () => {
        if (config.services.ceramic.mode == "client") {
            console.warn("skipping test since 'ceramic' is in http-client mode")
            return
        }

        const initialContent = { foo: 'bar' }
        const doc = await ceramic.createDocument(
            'tile', {content: initialContent}, {anchor:false, publish:false})
        expect(doc.content).toEqual(initialContent)
        const newContent = { bar: 'baz'}
        await doc.change({content: newContent}, {anchor:false, publish:false})
        expect(doc.content).toEqual(newContent)

        await ceramic.pin.add(doc.id)

        await restartCeramic()

        const loaded = await ceramic.loadDocument(doc.id)
        expect(loaded.content).toEqual(newContent)

        expect(await isPinned(ceramic, doc.id)).toBeTruthy()
        await ceramic.pin.rm(doc.id)
        expect(await isPinned(ceramic, doc.id)).toBeFalsy()
    })
})