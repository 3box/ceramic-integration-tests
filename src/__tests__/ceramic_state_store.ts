/**
 * @jest-environment ./build/index.js
 */

import { Ceramic } from '@ceramicnetwork/core'
import { StreamID } from '@ceramicnetwork/streamid'
import { TileDocument } from '@ceramicnetwork/stream-tile'
import { delay, restartCeramic } from '../utils.js'
import { config } from 'node-config-ts'
import { jest } from '@jest/globals'

declare global {
  let ceramic: Ceramic
}

const isPinned = async (ceramic: Ceramic, streamId: StreamID): Promise<boolean> => {
  const pinnedStreamsIterator = await ceramic.admin.pin.ls(streamId)
  const pinnedStreamIds = []
  for await (const id of pinnedStreamsIterator) {
    pinnedStreamIds.push(id)
  }
  return pinnedStreamIds.includes(streamId.toString())
}

describe('Ceramic state store tests', () => {
  jest.setTimeout(1000 * 60 * 5) // 5 minutes

  beforeAll(async () => {
    // Wait for previous test to fully finish cleaning up before restarting the Ceramic node
    await delay(2000)
  })

  test('Unpinned doc state does not survive ceramic restart', async () => {
    if (config.jest.services.ceramic.mode == 'client') {
      console.warn("skipping test since 'ceramic' is in http-client mode")
      return
    }

    console.log("Starting test 'Unpinned doc state does not survive ceramic restart'")

    const initialContent = { foo: 'bar' }
    const doc = await TileDocument.create<any>(ceramic, initialContent, null, {
      pin: false,
      anchor: false,
      publish: false,
    })
    expect(doc.content).toEqual(initialContent)
    const newContent = { bar: 'baz' }
    await doc.update(newContent, null, { anchor: false, publish: false })
    expect(doc.content).toEqual(newContent)

    expect(await isPinned(ceramic, doc.id)).toBeFalsy()

    await restartCeramic()

    const loaded = await ceramic.loadStream<TileDocument>(doc.id)
    expect(loaded.content).not.toEqual(newContent)
    expect(loaded.content).toEqual(initialContent)
    expect(await isPinned(ceramic, doc.id)).toBeFalsy()
  })

  test('Pinned doc state does survive ceramic restart', async () => {
    if (config.jest.services.ceramic.mode == 'client') {
      console.warn("skipping test since 'ceramic' is in http-client mode")
      return
    }

    console.log("Starting test 'Pinned doc state does survive ceramic restart'")

    const initialContent = { foo: 'bar' }
    const doc = await TileDocument.create<any>(ceramic, initialContent, null, {
      anchor: false,
      publish: false,
    })
    expect(doc.content).toEqual(initialContent)
    const newContent = { bar: 'baz' }
    await doc.update(newContent, null, { anchor: false, publish: false })
    expect(doc.content).toEqual(newContent)

    expect(await isPinned(ceramic, doc.id)).toBeTruthy()

    await restartCeramic()

    const loaded = await ceramic.loadStream<TileDocument>(doc.id)
    expect(loaded.content).toEqual(newContent)

    expect(await isPinned(ceramic, doc.id)).toBeTruthy()
    await ceramic.admin.pin.rm(doc.id)
    expect(await isPinned(ceramic, doc.id)).toBeFalsy()
  })
})
