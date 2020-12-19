import {CeramicApi} from '@ceramicnetwork/common';

export interface Services {
    ceramic: CeramicApi,
}

export interface Test {
    runTest(services: Services): Promise<void>
}

export const assert = function() {
    return {
        eq: (a: any, b: any, msg?: string) => {
            if (a !== b) {
                throw new Error(msg ?? `${a} !== ${b}`)
            }
        },
        neq: (a: any, b: any, msg?: string) => {
            if (a === b) {
                throw new Error(msg ?? `${a} === ${b}`)
            }
        }
    }
}()