import {CeramicApi} from '@ceramicnetwork/common';

export interface Services {
    ceramic: CeramicApi,
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

export abstract class Test {
    /**
     * Must be implemented by each Test, this is where the main test logic goes
     * @param services
     * @protected
     */
    protected abstract _runTest(services: Services): Promise<void>;

    /**
     * Must be implemented by each Test, controls how long the test can run before it is
     * declared failed due to timeout.
     * @param services
     * @protected
     */
    protected abstract _getTestTimeout(): number;

    /**
     * Public API for running tests that wraps the test-specific implementation
     * @param services
     */
    public async runTest(services: Services): Promise<void> {
        const timeout = this._getTestTimeout()
        await this._runWithTimeout(this._runTest(services), timeout)
    }

    /**
     * Applies a timeout to the given promise. Throws an exception if the timeout passes before
     * the given promise resolves.
     * @param p - promise to wait on with a timeout
     * @param timeout
     * @protected
     */
    protected async _runWithTimeout(p: Promise<void>, timeout: number): Promise<void> {
        const timeoutPromise = new Promise<void>(() => {
            const id = setTimeout(()=> {
                clearTimeout(id)
                throw new Error("Timeout exceeded: " + timeout)
            }, timeout)
        })

        return Promise.race([timeoutPromise, p])
    }
}
