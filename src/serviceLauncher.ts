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
                        CERAMIC_NETWORK: 'dev-unstable'
                    }
                }
            )
        } else if (service.type == 'ceramic') {
            subprocess = exec(
                `node node_modules/@ceramicnetwork/cli/bin/ceramic daemon \
                    --verbose \
                    --log-to-files \
                    --port ${service.port} \
                    --network dev-unstable \
                    --ethereum-rpc ${service.ethereumRpc}
                `
            )
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

readyCounter.on('update', (service: LaunchedService) => {
    const count = ready.length
    const total = launched.length
    console.log('\nServiceLauncher: updated')
    console.log(`=> Ready: ${service.type}`)
    console.log(`=> Pid: ${service.subprocess.pid}`)
    console.log(`=> Count: ${count}/${total}`)
    if (count >= total) {
        console.log('\nServiceLauncher: done')
        process.exit(0)
    }
})

process.on('SIGINT', () => {
    launched.forEach((service) => {
        service.subprocess.kill()
    })
})

main()
