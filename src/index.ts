import { CeramicApi, IpfsApi } from '@ceramicnetwork/common';
import CeramicClient from '@ceramicnetwork/http-client';
import { config } from 'node-config-ts';
import { Ed25519Provider } from 'key-did-provider-ed25519'
import ipfsClient from "ipfs-http-client"
import IPFS from "ipfs-core"
//@ts-ignore
import multiformats from 'multiformats/basics'
// @ts-ignore
import legacy from 'multiformats/legacy'

import tmp from 'tmp-promise'

import dagJose from 'dag-jose'
import Ceramic, { CeramicConfig } from "@ceramicnetwork/core";
import { randomBytes } from '@stablelib/random'
import NodeEnvironment from 'jest-environment-node'

const seed = randomBytes(32)

// Global services that are set up once and then available in all integration tests
declare global {
    const ceramic: CeramicApi
    const ceramic2: CeramicApi
}

const buildCeramic = async (configObj, ipfs: IpfsApi): Promise<CeramicApi> => {
    let ceramic
    if (configObj.mode == "client") {
        console.log("Creating ceramic via http client")
        ceramic = new CeramicClient(configObj.apiURL, { docSyncEnabled: true, docSyncInterval: 500 })
    } else if (configObj.mode == "node") {
        console.log("Creating ceramic via local node")
        const ceramicConfig: CeramicConfig = {
            networkName: configObj.network,
            pubsubTopic: configObj.pubsubTopic,
            ethereumRpcUrl: configObj.ethereumRpc,
            anchorServiceUrl: configObj.anchorServiceAPI,
        }
        ceramic = await Ceramic.create(ipfs, ceramicConfig)
    } else if (configObj.mode == "none") {
        return null
    } else {
        throw new Error(`Ceramic mode "${configObj.mode}" not supported`)
    }

    const didProvider = new Ed25519Provider(seed)
    await ceramic.setDIDProvider(didProvider)

    return ceramic
}

const buildIpfs = async (configObj): Promise<IpfsApi> => {
    let ipfs: IpfsApi
    multiformats.multicodec.add(dagJose)
    const format = legacy(multiformats, dagJose.name)
    if (configObj.mode == "client") {
        ipfs = ipfsClient({url: configObj.apiURL, ipld: {formats: [format]}})
    } else if (configObj.mode == "node") {
        const repoPath = (await tmp.dir()).path
        ipfs = await IPFS.create({
            repo: repoPath,
            ipld: {
                formats: [format]
            },
            libp2p: {
                config: {
                    dht: {
                        enabled: true,
                        clientMode: !configObj.dhtServerMode,
                        randomWalk: false,
                    },
                },
            },
            config: {
                Routing: {
                    Type: configObj.dhtServerMode ? 'dhtserver' : 'dhtclient',
                },
            }
        })
    } else if (configObj.mode == "none") {
        return null
    } else {
        throw new Error(`IPFS mode "${configObj.mode}" not supported`)
    }

    return ipfs
}

export default class IntegrationTestEnvironment extends NodeEnvironment {
    async setup() {
        await super.setup();

        try {
            await this.buildServicesFromConfig();
        } catch (e) {
            console.error("Building services failed", e.toString())
        }
    }

    async teardown() {
        // @ts-ignore
        await this.global.ceramic.close();

        await super.teardown()
    }

    private async buildServicesFromConfig() {
        const ipfs = await buildIpfs(config.services.ipfs)
        const ceramic = await buildCeramic(config.services.ceramic, ipfs)

        this.global.ceramic = ceramic
    }
}
