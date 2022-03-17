const path = require('path')
// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'public'),
})

const fruits = ['Apples', 'Oranges', 'Bananas', 'Pears', 'Grapes']
// returns each fruit one by one, round-robin style
let index = 0
fastify.get('/fruit', async (request, reply) => {
  // simulate an occasional server error if needed
  // if (Math.random() < 0.4) {
  //   throw new Error('Something went wrong')
  // }

  const fruit = fruits[index]
  index += 1
  if (index >= fruits.length) {
    index = 0
  }
  return { fruit }
})

// can return no fruits, one or more fruits
fastify.get('/fruits', async (request, reply) => {
  if (Math.random() < 0.1) {
    // small chance that it returns no fruits
    return []
  }

  const picked = fruits.filter(() => Math.random() < 0.5)
  return picked
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
