import { Ceramic } from '@ceramicnetwork/core'
import { StreamReaderWriter, IpfsApi } from '@ceramicnetwork/common'
import { config } from 'node-config-ts'

import { default as jestEnvironmentNode } from 'jest-environment-node'
const NodeEnvironment = (jestEnvironmentNode as any).default
import { buildCeramicClient, buildCeramicNode, buildIpfs, delay } from './utils.js'

// Global services that are set up once and then available in all integration tests
declare global {
  let ceramic: Ceramic
  const ceramicClient: StreamReaderWriter
  const ipfs: IpfsApi
}

export default class IntegrationTestEnvironment extends NodeEnvironment {
  async setup() {
    console.log('Setting up integration test')
    await super.setup()

    try {
      await this.buildServicesFromConfig()
    } catch (e) {
      console.error('Building services failed', e)
      process.exit(1)
    }
  }

  async teardown() {
    console.log('Tearing down integration test')

    await delay(5000) // Give some time for tests to fully finish

    // @ts-ignore
    await this.global.ceramic.close()
    this.global.ceramic = null

    // @ts-ignore
    await this.global.ceramicClient.close()
    this.global.ceramicClient = null

    // @ts-ignore
    this.global.ipfs = null

    await delay(5000) // Give some time for things to fully shut down

    await super.teardown()
  }

  private async buildServicesFromConfig() {
    console.info(`Starting test in environment: ${process.env.NODE_ENV}`)

    if (config.jest.services.ceramicClient.mode == 'node') {
      throw new Error("Mode 'node' isn't supported for 'ceramicClient'")
    }

    const ipfs = await buildIpfs(config.jest.services.ipfs)
    const ceramic = await buildCeramicNode(config.jest.services.ceramic, ipfs)
    const ceramicClient = await buildCeramicClient(config.jest.services.ceramicClient)

    await delay(5000) // Give some time for things to fully start up before continuing

    this.global.ceramic = ceramic
    this.global.ceramicClient = ceramicClient
    this.global.ipfs = ipfs
  }
}
