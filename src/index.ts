import {CeramicApi} from '@ceramicnetwork/common';

export interface Services {
    ceramic: CeramicApi,
}

export interface Test {
    runTest(services: Services): Promise<void>
}

export const assert = function() {
    return {
        eq: (given: any, expected: any, msg?: string) => {
            if (given !== expected) {
                throw new Error(msg ?? `${given} !== ${expected}`)
            }
        },
        neq: (given: any, expected: any, msg?: string) => {
            if (given === expected) {
                throw new Error(msg ?? `${given} === ${expected}`)
            }
        }
    }
}()