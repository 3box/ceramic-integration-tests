import { ChildProcess, exec } from 'child_process'
import EventEmitter from 'events'

import { config } from 'node-config-ts'

type LaunchedServiceId = number

interface LaunchedService {
    id: LaunchedServiceId,
    type: string,
    subprocess: ChildProcess
}

const launched: Array<LaunchedService> = []
const ready: Array<LaunchedServiceId> = []
const readyCounter = new EventEmitter()

function main() {
    console.log('\nServiceLauncher: running')

    for (const service of config.serviceLauncher.services) {
        console.log('=> Launching:', service.type)
        console.log(service)

        let subprocess = null

        if (service.type == 'ipfs') {
            subprocess = exec(`node node_modules/@ceramicnetwork/ipfs-daemon/bin/ipfs-daemon`,
                {
                    env: {
                        ...process.env,
                        IPFS_API_PORT: service.port,
                        CERAMIC_NETWORK: 'dev-unstable',
                        DEBUG: 'bitswap*'
                    }
                }
            )
        } else if (service.type == 'ceramic') {
            // Removing port due to https://github.com/ceramicnetwork/js-ceramic/issues/1681
            // and verbose logging
            subprocess = exec(
                `node node_modules/@ceramicnetwork/cli/bin/ceramic daemon \
                    --log-to-files \
                    --network dev-unstable \
                    --ethereum-rpc ${service.ethereumRpc}
                `
            )
            // Original command:
            // subprocess = exec(
            //     `node node_modules/@ceramicnetwork/cli/bin/ceramic daemon \
            //         --verbose \
            //         --log-to-files \
            //         --port ${service.port} \
            //         --network dev-unstable \
            //         --ethereum-rpc ${service.ethereumRpc}
            //     `
            // )
        } else {
            throw Error(`Unsupported service type: ${service.type}`)
        }
        subprocess && launched.push({
            id: launched.length + 1,
            type: service.type,
            subprocess
        })
    }
    launched.forEach((service) => {
        service.subprocess.stderr.on('data', console.error)
        service.subprocess.stdout.on('data', (data) => {
            console.log(data)
            // Wait for service to be ready
            setTimeout(() => {
                if (!ready.includes(service.id)) {
                    ready.push(service.id)
                    readyCounter.emit('update', service)
                }
            }, 10000)
        })
    })
    console.log('\nServiceLauncher: standby')
    console.log('=> Launched: all')
}

readyCounter.on('update', (service: