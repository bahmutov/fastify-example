const path = require('path')
const fs = require('fs')
// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })

const publicFolder = path.join(__dirname, 'public')

const clickJs = fs.readFileSync(path.join(publicFolder, 'click.js'), 'utf8')
const indexDoc = fs.readFileSync(path.join(publicFolder, 'index.html'), 'utf8')
const indexMobileDoc = fs.readFileSync(
  path.join(publicFolder, 'index-mobile.html'),
  'utf8',
)

function isMobile(headers) {
  return headers['user-agent'].includes('Mobile')
}

// if the sender sends "request-id" header
// return it as response header "x-request-id"
fastify.addHook('preHandler', (request, reply, done) => {
  const reqId = request.headers['request-id']
  if (reqId) {
    reply.header('x-request-id', reqId)
  }
  done()
})

fastify.addHook('preHandler', (request, reply, done) => {
  Object.keys(request.headers).forEach((key) => {
    if (key.startsWith('x')) {
      console.log(
        '%s %s with header %s: %s',
        request.method,
        request.url,
        key,
        request.headers[key],
      )
    }
  })
  done()
})

fastify.get('/click.js', async (request, reply) => {
  setTimeout(() => {
    reply.type('text/javascript').send(clickJs)
  }, 2000)
})

fastify.get('/', (request, reply) => {
  if (isMobile(request.headers)) {
    reply.type('text/html').send(indexMobileDoc)
  } else {
    reply.type('text/html').send(indexDoc)
  }
})

fastify.register(require('fastify-static'), {
  root: publicFolder,
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

// returns all possible fruits
fastify.get('/all-fruits', async (request, reply) => {
  return fruits.map((fruit, k) => ({ fruit, k }))
})

// this response never finishes
fastify.get('/fruit-long', (request, reply) => {})

// always returns the same object
fastify.get('/sale', async (request, reply) => {
  return {
    sale: {
      fruit: 'Mango',
      price: '$1.99',
      quantity: 20,
    },
  }
})

fastify.post('/track', (request, reply) => {
  return { ok: true }
})

fastify.post('/calculate', (request, reply) => {
  console.log(request.body)
  const { a, b, operation } = request.body
  if (operation === '+') {
    return { answer: a + b, a, b, operation }
  }
  if (operation === '-') {
    return { answer: a - b, a, b, operation }
  }
  throw new Error(`Unsupported operation: ${operation}`)
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
