/**
 * @jest-environment ./build/index.js
 */
import { jest } from '@jest/globals'
import { Page, StreamState, StreamUtils } from '@ceramicnetwork/common'
import { CommonTestUtils as TestUtils } from '@ceramicnetwork/common-test-utils'
import { ModelInstanceDocument } from '@ceramicnetwork/stream-model-instance'
import { StreamID } from '@ceramicnetwork/streamid'
import { config } from 'node-config-ts'
import { createDid } from '../utils.js'
import { DID } from 'dids'
import { firstValueFrom, timeout, throwError, filter, interval, concatMap } from 'rxjs'
import { CeramicClient } from '@ceramicnetwork/http-client'
import { Ceramic } from '@ceramicnetwork/core'

const TEST_MODEL = StreamID.fromString(config.jest.models[0])
const DATA1 = { data: 333 }
const DATA2 = { data: 444 }
const DATA3 = { data: 555 }

declare global {
  const ceramic: Ceramic | CeramicClient
  const ceramicClient: CeramicClient
}

const extractStreamStates = (page: Page<StreamState | null>): Array<StreamState> => {
  if (page.edges.some((edge) => edge.node === null)) {
    console.warn(
      'null stream state found. This may indicate a problem with data persistence of your state store, which can result in data loss.',
    )
  }

  return page.edges
    .filter((edge) => Boolean(edge.node))
    .map((edge) => edge.node) as Array<StreamState>
}

const extractDocuments = (
  ceramic: Ceramic | CeramicClient,
  page: Page<StreamState | null>,
): Array<ModelInstanceDocument> => {
  return extractStreamStates(page).map((state) =>
    ceramic.buildStreamFromState<ModelInstanceDocument>(state),
  )
}

const waitForMidsToBeIndexed = async (
  ceramic: Ceramic | CeramicClient,
  docs: ModelInstanceDocument[],
): Promise<void> => {
  await firstValueFrom(
    // polls the index checking if the MIDs we are interested in are included and up to date
    interval(1000).pipe(
      // queries the index and extract the documents
      concatMap(() =>
        ceramic.index
          .query({ model: TEST_MODEL, last: 100 })
          .then((resultObj) => extractDocuments(ceramic, resultObj)),
      ),
      // checks if the results contains all the docs we are interested in
      filter((results) => {
        return docs.every((doc) =>
          results.find(
            (resultDoc) =>
              resultDoc.id.toString() === doc.id.toString() &&
              resultDoc.content.data === doc.content.data,
          ),
        )
      }),
      // timeout after 30 second
      timeout({
        each: 30000,
        with: () =>
          throwError(
            () =>
              new Error(
                `Timeout waiting for ${docs.map((doc) => doc.id.toString())} at tips ${docs.map(
                  (doc) => doc.tip.toString(),
                )} to be indexed`,
              ),
          ),
      }),
    ),
  )
}

describe('indexing', () => {
  describe('Using existing model', () => {
    jest.setTimeout(1000 * 90) // 1 and a half minutes per test
    const originalDid = ceramic.did as DID

    const singleNodeTestCases: any[] = [['ceramic', ceramic]]
    const twoNodesTestCases: any[] = []

    if (config.jest.services.ceramicClient.indexingEnabled) {
      singleNodeTestCases.push(['ceramicClient', ceramicClient])
    }

    if (
      config.jest.services.ceramic.indexingEnabled &&
      config.jest.services.ceramicClient.indexingEnabled
    ) {
      twoNodesTestCases.push(['creating: ceramic, loading: ceramicClient', ceramic, ceramicClient])
      twoNodesTestCases.push(['creating: ceramicClient, loading: ceramic', ceramicClient, ceramic])
    }

    afterEach(() => {
      ceramic.did = originalDid
      ceramicClient.did = originalDid
    })

    if (singleNodeTestCases.length > 0) {
      test.each(singleNodeTestCases)(
        'Can create and query on same node -- %s',
        async (_, ceramicInstance: Ceramic | CeramicClient) => {
          console.info('running test: Can create and query on same node')

          const doc1 = await ModelInstanceDocument.create(
            ceramicInstance,
            DATA1,
            { model: TEST_MODEL },
            { anchor: false },
          )

          await waitForMidsToBeIndexed(ceramicInstance, [doc1])

          await expect(
            ceramicInstance.index.count({ model: TEST_MODEL.toString() }),
          ).resolves.toBeGreaterThanOrEqual(1)

          const resultsAfterCreate = await ceramicInstance.index
            .query({ model: TEST_MODEL, last: 100 })
            .then((resultObj) => extractDocuments(ceramicInstance, resultObj))

          // We cannot expect that the most recent MIDs will be the MIDs created by this test
          // This is because this model may be used in other places while this test is running
          const retrievedCreatedDoc1 = resultsAfterCreate.find(
            (doc) => doc.id.toString() === doc1.id.toString(),
          ) as ModelInstanceDocument
          expect(StreamUtils.serializeState(retrievedCreatedDoc1.state)).toEqual(
            StreamUtils.serializeState(doc1.state),
          )

          await doc1.replace(DATA2, null, { anchor: false })
          const doc2 = await ModelInstanceDocument.create(
            ceramicInstance,
            DATA3,
            { model: TEST_MODEL },
            { anchor: false },
          )

          await waitForMidsToBeIndexed(ceramicInstance, [doc1, doc2])

          await expect(
            ceramicInstance.index.count({ model: TEST_MODEL.toString() }),
          ).resolves.toBeGreaterThanOrEqual(2)

          const resultsAfterReplace = await ceramicInstance.index
            .query({ model: TEST_MODEL, last: 100 })
            .then((resultObj) => extractDocuments(ceramicInstance, resultObj))
          expect(resultsAfterReplace.length).toBeGreaterThanOrEqual(2)

          const retrievedReplacedDoc1 = resultsAfterReplace.find(
            (doc) => doc.id.toString() === doc1.id.toString(),
          ) as ModelInstanceDocument
          expect(StreamUtils.serializeState(retrievedReplacedDoc1.state)).toEqual(
            StreamUtils.serializeState(doc1.state),
          )

          const retrievedDoc2 = resultsAfterReplace.find(
            (doc) => doc.id.toString() === doc2.id.toString(),
          ) as ModelInstanceDocument
          expect(StreamUtils.serializeState(retrievedDoc2.state)).toEqual(
            StreamUtils.serializeState(doc2.state),
          )

          console.info('completed test: Can create and query on same node')
        },
      )

      test.each(singleNodeTestCases)(
        'Can filter by DID -- %s',
        async (_, ceramicInstance: Ceramic | CeramicClient) => {
          console.info('running test: Can filter by DID')

          const did1 = originalDid
          const did2 = await createDid()

          const doc1 = await ModelInstanceDocument.create(
            ceramicInstance,
            DATA1,
            { model: TEST_MODEL, controller: did1.id },
            { anchor: false },
          )

          ceramicInstance.did = did2
          const doc2 = await ModelInstanceDocument.create(
            ceramicInstance,
            DATA2,
            { model: TEST_MODEL, controller: did2.id },
            { anchor: false },
          )

          await waitForMidsToBeIndexed(ceramicInstance, [doc1, doc2])

          const did1Results = await ceramicInstance.index
            .query({ model: TEST_MODEL, last: 100, account: did1.id })
            .then((resultObj) => extractDocuments(ceramicInstance, resultObj))

          expect(did1Results.length).toBeGreaterThanOrEqual(1)
          // We cannot expect that the most recent MID will be the MID created by this test
          // This is because we may receive and process pubsub messages for docs created in previous tests
          // ex. docs created by the ceramicClient in the previous test, may be received by ceramic in this test
          const retrievedDoc1 = did1Results.find(
            (doc) => doc.id.toString() === doc1.id.toString(),
          ) as ModelInstanceDocument
          expect(StreamUtils.serializeState(retrievedDoc1.state)).toEqual(
            StreamUtils.serializeState(doc1.state),
          )
          did1Results.forEach((doc) => {
            expect(doc.id.toString()).not.toEqual(doc2.id.toString())
          })

          const did2Results = await ceramicInstance.index
            .query({ model: TEST_MODEL, last: 100, account: did2.id })
            .then((resultObj) => extractDocuments(ceramicInstance, resultObj))
          expect(did2Results.length).toBeGreaterThanOrEqual(1)
          const retrievedDoc2 = did2Results.find(
            (doc) => doc.id.toString() === doc2.id.toString(),
          ) as ModelInstanceDocument
          expect(StreamUtils.serializeState(retrievedDoc2.state)).toEqual(
            StreamUtils.serializeState(doc2.state),
          )
          did2Results.forEach((doc) => {
            expect(doc.id.toString()).not.toEqual(doc1.id.toString())
          })

          console.info('Completed test: Can filter by DID')
        },
      )
    }

    if (twoNodesTestCases.length > 0) {
      test.each(twoNodesTestCases)(
        'Can create and query across nodes -- %s',
        async (_, ceramic1: Ceramic | CeramicClient, ceramic2: Ceramic | CeramicClient) => {
          console.info('running test: Can create and query across nodes')

          const doc = await ModelInstanceDocument.create(
            ceramic1,
            DATA1,
            { model: TEST_MODEL },
            { anchor: false, publish: false },
          )

          await TestUtils.delay(15 * 1000)

          // Since ceramic1 didn't publish the commit, ceramic2 won't know about it.
          const resultsAfterCreate = await ceramic2.index
            .query({ model: TEST_MODEL, last: 100 })
            .then((resultObj) => extractDocuments(ceramic2, resultObj))

          if (resultsAfterCreate.length > 0) {
            const retrievedDocAfterCreate = resultsAfterCreate.find(
              (result) => result.id.toString() === doc.id.toString(),
            ) as ModelInstanceDocument
            expect(retrievedDocAfterCreate).toBeUndefined
          }

          // Explicitly loading the stream on ceramic2 should add it to the index.
          const loadedDoc = await ModelInstanceDocument.load(ceramic2, doc.id)
          expect(loadedDoc.content).toEqual(doc.content)

          // Indexed streams should always get pinned, regardless of the 'pin' flag
          await expect(TestUtils.isPinned(ceramic2.admin, doc.id)).toBeTruthy()

          await expect(
            ceramic2.index.count({ model: TEST_MODEL.toString() }),
          ).resolves.toBeGreaterThan(1)
          const resultsAfterLoad = await ceramic2.index
            .query({ model: TEST_MODEL, last: 100 })
            .then((resultObj) => extractDocuments(ceramic2, resultObj))
          expect(resultsAfterLoad.length).toBeGreaterThanOrEqual(1)

          const retrievedDocAfterLoad = resultsAfterLoad.find(
            (result) => result.id.toString() === doc.id.toString(),
          ) as ModelInstanceDocument
          expect(retrievedDocAfterLoad).not.toBeUndefined
          expect(retrievedDocAfterLoad.content).toEqual(doc.content)
          expect(StreamUtils.serializeState(retrievedDocAfterLoad.state)).toEqual(
            StreamUtils.serializeState(doc.state),
          )

          await doc.replace(DATA2, null, { anchor: false })

          await waitForMidsToBeIndexed(ceramic2, [doc])

          const resultsAfterReplace = await ceramic2.index
            .query({ model: TEST_MODEL, last: 100 })
            .then((resultObj) => extractDocuments(ceramic2, resultObj))
          expect(resultsAfterReplace.length).toBeGreaterThanOrEqual(1)

          const retrievedDocAfterReplace = resultsAfterReplace.find(
            (result) => result.id.toString() === doc.id.toString(),
          ) as ModelInstanceDocument
          expect(StreamUtils.serializeState(retrievedDocAfterReplace.state)).toEqual(
            StreamUtils.serializeState(doc.state),
          )

          console.info('completed test: Can create and query across nodes')
        },
      )

      test.each(twoNodesTestCases)(
        'Can filter by DID across nodes -- %s',
        async (_, ceramic1, ceramic2) => {
          console.info('running test: Can filter by DID across nodes')

          const did1 = originalDid
          const did2 = await createDid()

          const doc1 = await ModelInstanceDocument.create(
            ceramic1,
            DATA1,
            { model: TEST_MODEL, controller: did1.id },
            { anchor: false },
          )

          console.log('created doc1', doc1.id.toString())

          ceramic1.did = did2
          const doc2 = await ModelInstanceDocument.create(
            ceramic1,
            DATA2,
            { model: TEST_MODEL, controller: did2.id },
            { anchor: false },
          )

          console.log('created doc2', doc2.id.toString())

          await waitForMidsToBeIndexed(ceramic2, [doc1, doc2])

          const did1Results = await ceramic2.index
            .query({ model: TEST_MODEL, last: 100, account: did1.id })
            .then((resultObj) => extractDocuments(ceramic2, resultObj))
          expect(did1Results.length).toBeGreaterThanOrEqual(1)

          // We cannot expect that the most recent MID will be the MID created by this test
          // This is because we may receive and process pubsub messages for docs created in previous tests
          // ex. docs created by the ceramicClient in the previous test, may be received by ceramic in this test
          const retrievedDid1Doc = did1Results.find(
            (doc) => doc.id.toString() === doc1.id.toString(),
          ) as ModelInstanceDocument
          expect(retrievedDid1Doc.content).toEqual(doc1.content)
          expect(StreamUtils.serializeState(retrievedDid1Doc.state)).toEqual(
            StreamUtils.serializeState(doc1.state),
          )

          const did2Results = await ceramic2.index
            .query({ model: TEST_MODEL, last: 100, account: did2.id })
            .then((resultObj) => extractDocuments(ceramic2, resultObj))
          expect(did2Results.length).toBeGreaterThanOrEqual(1)

          const retrievedDid2Doc = did2Results.find(
            (doc) => doc.id.toString() === doc2.id.toString(),
          ) as ModelInstanceDocument
          expect(retrievedDid2Doc.id.toString()).toEqual(doc2.id.toString())
          expect(retrievedDid2Doc.content).toEqual(doc2.content)
          expect(StreamUtils.serializeState(retrievedDid2Doc.state)).toEqual(
            StreamUtils.serializeState(doc2.state),
          )

          console.info('completed test: Can filter by DID across nodes')
        },
      )
    }
  })
})
