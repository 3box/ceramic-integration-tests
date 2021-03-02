const { uniqueNamesGenerator, adjectives, animals, colors } = require('unique-names-generator')

function main() {
  const runId = uniqueNamesGenerator({
    dictionaries: [adjectives, animals, colors],
    length: 3
  })
  console.log(runId)
}

main()
