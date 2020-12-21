import {assert, Services} from "../index";
import { TileDoctype } from "@ceramicnetwork/doctype-tile"

export class CeramicCasTest {
    public async runTest(services: Services): Promise<void> {
        const {ceramic} = services

        const initialContent = { foo: 'bar' }
        const doc = await ceramic.createDocument<TileDoctype>('tile',
            {content: initialContent})

        assert.eq(doc.content.toString(), initialContent.toString())
    }
}