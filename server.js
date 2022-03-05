const path = require('path')
// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'public'),
})

fastify.get('/fruit', async (request, reply) => {
  const fruits = ['Apples', 'Oranges', 'Bananas', 'Pears', 'Grapes']
  const randomFruit = fruits[Math.floor(Math.random() * fruits.length)]
  return { fruit: randomFruit }
})

// Run the server!
const start = async () => {
  try {
    await fastify.listen(4200)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
