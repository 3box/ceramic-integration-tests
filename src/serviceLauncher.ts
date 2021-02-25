import { ChildProcess, exec } from 'child_process'
import EventEmitter from 'events'

import { config } from 'node-config-ts'

const subprocessList: Array<{ service: string, subprocess: ChildProcess }> = []
const servicesReady: { [service: string]: number } = {}
const readyCounter = new EventEmitter()

function main() {
    console.log('\nServiceLauncher: running')

    const services = Object.keys(config.services)
    // Must start all ipfs services before ceramic ones
    services.sort((a, b) => (a > b) ? 1 : -1)

    for (const service of services) {
        const serviceConfig = config.services[service]
        if (serviceConfig.launchLocation != 'serviceLauncher') {
            continue
        } else {
            console.log('=> Launching:', service)
            console.log(serviceConfig)

            let subprocess = null
            if (service.startsWith('ipfs')) {
                subprocess = exec(`node node_modules/js-ipfs-ceramic/build/index`,
                    {
                        env: {
                            ...process.env,
                            IPFS_API_PORT: serviceConfig.port
                        }
                    }
                )
            } else if (service.startsWith('ceramic')) {
                subprocess = exec(
                    `npx @ceramicnetwork/cli daemon \
                      --port ${serviceConfig.port}
                    `
                )
            } else {
                throw Error(`Unsupported service with name ${service}`)
            }

            subprocess && subprocessList.push({ service, subprocess })
        }
    }
    subprocessList.forEach((item) => {
        item.subprocess.stderr.on('data', console.error)
        item.subprocess.stdout.on('data', (data) => {
            if (servicesReady[item.service] != 1) {
                servicesReady[item.service] = 1
                readyCounter.emit('update', item.service, item.subprocess.pid)
            }
            console.log(data)
        })
    })
    console.log('\nServiceLauncher: standby')
    console.log('=> Launched: all')
}

readyCounter.on('update', (service, pid) => {
    const count = Object.values(servicesReady).reduce((x: number, y: number) => x + y)
    const total = subprocessList.length
    console.log('\nServiceLauncher: updated')
    console.log(`=> Ready: ${service}`)
    console.log(`=> Pid: ${pid}`)
    console.log(`=> Count: ${count}/${total}`)
    if (count >= total) {
        console.log('\nServiceLauncher: done')
        process.exit(0)
    }
})

process.on('SIGINT', () => {
    subprocessList.forEach((item) => {
        item.subprocess.kill()
    })
})

main()
