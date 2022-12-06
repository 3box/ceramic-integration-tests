/**
 * @jest-environment ./build/index.js
 */
import { jest } from '@jest/globals'
import { CeramicApi, Page, StreamState, StreamUtils, TestUtils } from '@ceramicnetwork/common'
import { ModelInstanceDocument } from '@ceramicnetwork/stream-model-instance'
import { StreamID } from '@ceramicnetwork/streamid'
import { config } from 'node-config-ts'
import { createDid } from '../utils.js'

const TEST_MODEL = StreamID.fromString(config.jest.models[0])
const DATA1 = { data: 333 }
const DATA2 = { data: 444 }
const DATA3 = { data: 555 }

const TEST_MODEL_WITH_RELATION = StreamID.fromString(config.jest.models[1])

declare global {
  const ceramic: CeramicApi
  const ceramicClient: CeramicApi
}

const extractStreamStates = (page: Page<StreamState | null>): Array<StreamState> => {
  if (page.edges.find(edge => edge.node === null)) {
    throw new Error(
      'null stream state found. This may indicate a problem with data persistence of your state store, which can result in data loss.'
    )
  }

  return page.edges.map(edge => edge.node) as Array<StreamState>
}

const extractDocuments = (
  ceramic: CeramicApi,
  page: Page<StreamState | null>
): Array<ModelInstanceDocument> => {
  return extractStreamStates(page).map(state =>
    ceramic.buildStreamFromState<ModelInstanceDocument>(state)
  )
}

describe('indexing', () => {
  describe('Using existing model', () => {
    jest.setTimeout(1000 * 60)
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
      twoNodesTestCases.push([
        'across nodes -- creating: ceramic, loading: ceramicClient',
        ceramic,
        ceramicClient
      ])
      twoNodesTestCases.push([
        'across nodes -- creating: ceramicClient, loading: ceramic',
        ceramicClient,
        ceramic
      ])
    }

    const allTestCases = singleNodeTestCases.concat(twoNodesTestCases)

    afterEach(() => {
      ceramic.did = originalDid
      ceramicClient.did = originalDid
    })

    test.each(singleNodeTestCases)(
      'Can create and query on same node -- %s',
      async (_, ceramicInstance: CeramicApi) => {
        const doc1 = await ModelInstanceDocument.create(
          ceramicInstance,
          DATA1,
          { model: TEST_MODEL },
          { anchor: false }
        )

        await expect(
          ceramicInstance.index.count({ model: TEST_MODEL.toString() })
        ).resolves.toBeGreaterThanOrEqual(1)

        const resultsAfterCreate = await ceramicInstance.index
          .query({ model: TEST_MODEL, last: 100 })
          .then(resultObj => extractDocuments(ceramicInstance, resultObj))
        expect(resultsAfterCreate.length).toBeGreaterThanOrEqual(1)

        // We cannot expect that the most recent MIDs will be the MIDs created by this test
        // This is because this model may be used in other places while this test is running
        const retrievedCreatedDoc1 = resultsAfterCreate.find(
          doc => doc.id.toString() === doc1.id.toString()
        ) as ModelInstanceDocument
        expect(retrievedCreatedDoc1).not.toBeUndefined
        expect(retrievedCreatedDoc1.content).toEqual(doc1.content)
        expect(StreamUtils.serializeState(retrievedCreatedDoc1.state)).toEqual(
          StreamUtils.serializeState(doc1.state)
        )

        await doc1.replace(DATA2, { anchor: false })
        const doc2 = await ModelInstanceDocument.create(
          ceramicInstance,
          DATA3,
          { model: TEST_MODEL },
          { anchor: false }
        )

        await TestUtils.delay(5 * 1000)

        await expect(
          ceramicInstance.index.count({ model: TEST_MODEL.toString() })
        ).resolves.toBeGreaterThanOrEqual(2)

        const resultsAfterReplace = await ceramicInstance.index
          .query({ model: TEST_MODEL, last: 100 })
          .then(resultObj => extractDocuments(ceramicInstance, resultObj))
        expect(resultsAfterReplace.length).toBeGreaterThanOrEqual(2)

        const retrievedReplacedDoc1 = resultsAfterReplace.find(
          doc => doc.id.toString() === doc1.id.toString()
        ) as ModelInstanceDocument
        expect(retrievedReplacedDoc1).not.toBeUndefined
        expect(retrievedReplacedDoc1.content).toEqual(doc1.content)
        expect(StreamUtils.serializeState(retrievedReplacedDoc1.state)).toEqual(
          StreamUtils.serializeState(doc1.state)
        )

        const retrievedDoc2 = resultsAfterReplace.find(
          doc => doc.id.toString() === doc2.id.toString()
        ) as ModelInstanceDocument
        expect(retrievedDoc2).not.toBeUndefined
        expect(retrievedDoc2.content).toEqual(doc2.content)
        expect(StreamUtils.serializeState(retrievedDoc2.state)).toEqual(
          StreamUtils.serializeState(doc2.state)
        )
      }
    )

    if (twoNodesTestCases.length > 0) {
      test.each(twoNodesTestCases)(
        'Can create and query across nodes -- %s',
        async (_, ceramic1: CeramicApi, ceramic2: CeramicApi) => {
          const doc = await ModelInstanceDocument.create(
            ceramic1,
            DATA1,
            { model: TEST_MODEL },
            { anchor: false, publish: false }
          )

          await TestUtils.delay(10 * 1000)

          // Since ceramic1 didn't publish the commit, ceramic2 won't know about it.
          const resultsAfterCreate = await ceramic2.index
            .query({ model: TEST_MODEL, last: 100 })
            .then(resultObj => extractDocuments(ceramic2, resultObj))

          if (resultsAfterCreate.length > 0) {
            const retrievedDocAfterCreate = resultsAfterCreate.find(
              result => result.id.toString() === doc.id.toString()
            ) as ModelInstanceDocument
            expect(retrievedDocAfterCreate).toBeUndefined
          }

          // Explicitly loading the stream on ceramic2 should add it to the index.
          const loadedDoc = await ModelInstanceDocument.load(ceramic2, doc.id)
          expect(loadedDoc.content).toEqual(doc.content)

          // Indexed streams should always get pinned, regardless of the 'pin' flag
          await expect(TestUtils.isPinned(ceramic2, doc.id)).toBeTruthy()

          await expect(
            ceramic2.index.count({ model: TEST_MODEL.toString() })
          ).resolves.toBeGreaterThan(1)
          const resultsAfterLoad = await ceramic2.index
            .query({ model: TEST_MODEL, last: 100 })
            .then(resultObj => extractDocuments(ceramic2, resultObj))
          expect(resultsAfterLoad.length).toBeGreaterThanOrEqual(1)

          // We cannot expect that the most recent MIDs will be the MIDs created by this test
          // This is because this model may be used in other places while this test is running
          const retrievedDocAfterLoad = resultsAfterLoad.find(
            result => result.id.toString() === doc.id.toString()
          ) as ModelInstanceDocument
          expect(retrievedDocAfterLoad).not.toBeUndefined
          expect(retrievedDocAfterLoad.content).toEqual(doc.content)
          expect(StreamUtils.serializeState(retrievedDocAfterLoad.state)).toEqual(
            StreamUtils.serializeState(doc.state)
          )

          await doc.replace(DATA2, { anchor: false })

          await TestUtils.delay(10 * 1000)

          const resultsAfterReplace = await ceramic2.index
            .query({ model: TEST_MODEL, last: 100 })
            .then(resultObj => extractDocuments(ceramic2, resultObj))
          expect(resultsAfterReplace.length).toBeGreaterThanOrEqual(1)

          const retrievedDocAfterReplace = resultsAfterReplace.find(
            result => result.id.toString() === doc.id.toString()
          ) as ModelInstanceDocument
          expect(retrievedDocAfterReplace).not.toBeUndefined
          expect(retrievedDocAfterReplace.content).toEqual(doc.content)
          expect(StreamUtils.serializeState(retrievedDocAfterReplace.state)).toEqual(
            StreamUtils.serializeState(doc.state)
          )
        }
      )
    }

    describe('filtering', () => {
      test.each(allTestCases)(
        'Can filter by DID -- %s',
        async (_, ceramic1, ceramic2 = ceramic1) => {
          const did1 = originalDid
          const did2 = await createDid()

          const doc1 = await ModelInstanceDocument.create(
            ceramic1,
            DATA1,
            { model: TEST_MODEL, controller: did1.id },
            { anchor: false }
          )

          ceramic1.did = did2
          const doc2 = await ModelInstanceDocument.create(
            ceramic1,
            DATA2,
            { model: TEST_MODEL, controller: did2.id },
            { anchor: false }
          )

          await TestUtils.delay(10 * 1000)

          const did1Results = await ceramic2.index
            .query({ model: TEST_MODEL, last: 100, account: did1.id })
            .then(resultObj => extractDocuments(ceramic2, resultObj))
          expect(did1Results.length).toBeGreaterThanOrEqual(1)

          // We can expect that the most recent MID will be the MID created by this test
          // This is because the DID used is unique and we are filtering by this DID
          const lastDid1Doc = did1Results.at(-1) as ModelInstanceDocument
          expect(lastDid1Doc.id.toString()).toEqual(doc1.id.toString())
          expect(lastDid1Doc.content).toEqual(doc1.content)
          expect(StreamUtils.serializeState(lastDid1Doc.state)).toEqual(
            StreamUtils.serializeState(doc1.state)
          )
          did1Results.forEach(doc => {
            expect(doc.id.toString()).not.toEqual(doc2.id.toString())
          })

          const did2Results = await ceramic2.index
            .query({ model: TEST_MODEL, last: 100, account: did2.id })
            .then(resultObj => extractDocuments(ceramic2, resultObj))
          expect(did2Results.length).toBeGreaterThanOrEqual(1)
          const lastDid2Doc = did2Results.at(-1) as ModelInstanceDocument
          expect(lastDid2Doc.id.toString()).toEqual(doc2.id.toString())
          expect(lastDid2Doc.content).toEqual(doc2.content)
          expect(StreamUtils.serializeState(lastDid2Doc.state)).toEqual(
            StreamUtils.serializeState(doc2.state)
          )
          did2Results.forEach(doc => {
            expect(doc.id.toString()).not.toEqual(doc1.id.toString())
          })
        }
      )

      test.each(allTestCases)(
        'Can filter by relation -- %s',
        async (_, ceramic1, ceramic2 = ceramic1) => {
          const referencedDoc0 = await ModelInstanceDocument.create(
            ceramic1,
            DATA1,
            {
              model: TEST_MODEL
            },
            { anchor: false }
          )
          const referencedDoc1 = await ModelInstanceDocument.create(
            ceramic1,
            DATA2,
            {
              model: TEST_MODEL
            },
            { anchor: false }
          )

          const doc0 = await ModelInstanceDocument.create(
            ceramic1,
            { linkedDoc: referencedDoc0.id.toString() },
            { model: TEST_MODEL_WITH_RELATION },
            { anchor: false }
          )
          const doc1 = await ModelInstanceDocument.create(
            ceramic1,
            { linkedDoc: referencedDoc1.id.toString() },
            { model: TEST_MODEL_WITH_RELATION },
            { anchor: false }
          )
          const doc2 = await ModelInstanceDocument.create(
            ceramic1,
            { linkedDoc: referencedDoc1.id.toString() },
            { model: TEST_MODEL_WITH_RELATION },
            { anchor: false }
          )

          await TestUtils.delay(5 * 1000)

          await expect(
            ceramic2.index.count({
              model: TEST_MODEL_WITH_RELATION,
              filter: { linkedDoc: referencedDoc0.id.toString() }
            })
          ).resolves.toEqual(1)
          const referencedDoc0Results = await ceramic2.index
            .query({
              model: TEST_MODEL_WITH_RELATION,
              last: 100,
              filter: { linkedDoc: referencedDoc0.id.toString() }
            })
            .then(resultObj => extractDocuments(ceramic2, resultObj))
          // We can expect that MIDs found will be the MID created by this test even though the model may be used by other tests
          // This is because the referenced docs are unique
          expect(referencedDoc0Results.length).toEqual(1)
          expect(referencedDoc0Results[0].id.toString()).toEqual(doc0.id.toString())
          expect(referencedDoc0Results[0].content).toEqual(doc0.content)
          expect(StreamUtils.serializeState(referencedDoc0Results[0].state)).toEqual(
            StreamUtils.serializeState(doc0.state)
          )

          await expect(
            ceramic2.index.count({
              model: TEST_MODEL_WITH_RELATION,
              filter: { linkedDoc: referencedDoc1.id.toString() }
            })
          ).resolves.toEqual(2)
          const referencedDoc1Results = await ceramic2.index
            .query({
              model: TEST_MODEL_WITH_RELATION,
              last: 100,
              filter: { linkedDoc: referencedDoc1.id.toString() }
            })
            .then(resultObj => extractDocuments(ceramic2, resultObj))
          expect(referencedDoc1Results.length).toEqual(2)
          expect(referencedDoc1Results[0].id.toString()).toEqual(doc1.id.toString())
          expect(referencedDoc1Results[0].content).toEqual(doc1.content)
          expect(StreamUtils.serializeState(referencedDoc1Results[0].state)).toEqual(
            StreamUtils.serializeState(doc1.state)
          )
          expect(referencedDoc1Results[1].id.toString()).toEqual(doc2.id.toString())
          expect(referencedDoc1Results[1].content).toEqual(doc2.content)
          expect(StreamUtils.serializeState(referencedDoc1Results[1].state)).toEqual(
            StreamUtils.serializeState(doc2.state)
          )
        }
      )

      test.each(allTestCases)(
        'Can filter by relation and did -- %s',
        async (_, ceramic1, ceramic2 = ceramic1) => {
          const referencedDoc = await ModelInstanceDocument.create(
            ceramic1,
            DATA1,
            {
              model: TEST_MODEL
            },
            { anchor: false }
          )

          const originalDidDoc = await ModelInstanceDocument.create(
            ceramic1,
            { linkedDoc: referencedDoc.id.toString() },
            { model: TEST_MODEL_WITH_RELATION },
            { anchor: false }
          )

          const otherDid = await createDid()
          ceramic1.did = otherDid
          await ModelInstanceDocument.create(
            ceramic1,
            { linkedDoc: referencedDoc.id.toString() },
            { model: TEST_MODEL_WITH_RELATION },
            { anchor: false }
          )

          await TestUtils.delay(5 * 1000)

          await expect(
            ceramic2.index.count({
              model: TEST_MODEL_WITH_RELATION,
              filter: { linkedDoc: referencedDoc.id.toString() }
            })
          ).resolves.toEqual(2)
          const allReferencedDocResults = await ceramic2.index
            .query({
              model: TEST_MODEL_WITH_RELATION,
              last: 100,
              filter: { linkedDoc: referencedDoc.id.toString() }
            })
            .then(resultObj => extractDocuments(ceramic2, resultObj))
          // We can expect that MIDs found will be the MID created by this test even though the model may be used by other tests
          // This is because the referenced docs are unique
          expect(allReferencedDocResults.length).toEqual(2)

          await expect(
            ceramic2.index.count({
              model: TEST_MODEL_WITH_RELATION,
              account: originalDid.id.toString(),
              filter: { linkedDoc: referencedDoc.id.toString() }
            })
          ).resolves.toEqual(1)
          const referencedDocsWithDidResults = await ceramic2.index
            .query({
              model: TEST_MODEL_WITH_RELATION,
              account: originalDid.id.toString(),
              last: 100,
              filter: { linkedDoc: referencedDoc.id.toString() }
            })
            .then(resultObj => extractDocuments(ceramic2, resultObj))
          expect(referencedDocsWithDidResults.length).toEqual(1)
          expect(referencedDocsWithDidResults[0].id.toString()).toEqual(
            originalDidDoc.id.toString()
          )
          expect(referencedDocsWithDidResults[0].content).toEqual(originalDidDoc.content)
          expect(StreamUtils.serializeState(referencedDocsWithDidResults[0].state)).toEqual(
            StreamUtils.serializeState(originalDidDoc.state)
          )
        }
      )
    })
  })
})
