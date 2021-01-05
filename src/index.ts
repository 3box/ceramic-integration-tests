import {CeramicApi} from '@ceramicnetwork/common';
import CeramicClient from '@ceramicnetwork/http-client';
import { config } from 'node-config-ts';
import { Ed25519Provider } from 'key-did-provider-ed25519'
import { randomBytes } from '@stablelib/random'

const seed = randomBytes(32)

/**
 * The group of handles to services that tests might interact with
 */
export interface Services {
    ceramic: CeramicApi,
}

export const buildServicesFromConfig = async (): Promise<Services> => {
    let ceramic
    if (config.ceramic.mode == "client") {
        ceramic = new CeramicClient(config.ceramic.apiURL, { docSyncEnabled: true, docSyncInterval: 500 })
    } else if (config.ceramic.mode == "node") {
        // TODO
        throw new Error ("not supported yet")
    } else {
        throw new Error(`Ceramic mode "${config.ceramic.mode}" not supported`)
    }

    const didProvider = new Ed25519Provider(seed)
    await ceramic.setDIDProvider(didProvider)

    return {ceramic}
}
