import {assert, Services} from "../index";
import { TileDoctype, TileParams } from "@ceramicnetwork/doctype-tile"

export class CeramicCasTest {
    public async runTest(services: Services): Promise<void> {
        assert.eq(2, 4)
        // const {ceramic} = services
        //
        // const initialContent = { foo: 'bar' }
        // const doc = ceramic.createDocument<TileDoctype>('tile',
        //     {content: initialContent})

    }
}