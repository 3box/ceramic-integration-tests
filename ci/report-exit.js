const child_process = require('child_process')

function main() {
  const message = [
    {
      title: 'Tests Exited',
      description: `Run Id: ${process.env.RUN_ID}`,
      color: 16711712,
      fields: [
        {
          name: 'Configuration',
          value: `${process.env.NODE_ENV}`,
        }
      ],
    },
  ]
  const data = { embeds: message, username: 'jest-reporter' }
  const out = child_process.execSync(
    `curl -X POST \
        -H "Content-Type: application/json" \
        -d '${JSON.stringify(data)}' \
        ${process.env.DISCORD_WEBHOOK_URL}`
  )
  console.log(out.toString())
}

main()
