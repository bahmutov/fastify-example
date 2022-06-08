const path = require('path')
const fs = require('fs')
const FastifySSEPlugin = require('fastify-sse-v2')
// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })

const publicFolder = path.join(__dirname, 'public')

const clickJs = fs.readFileSync(path.join(publicFolder, 'click.js'), 'utf8')
const indexDoc = fs.readFileSync(path.join(publicFolder, 'index.html'), 'utf8')
const indexMobileDoc = fs.readFileSync(
  path.join(publicFolder, 'index-mobile.html'),
  'utf8',
)
const unreliableDoc = fs.readFileSync(
  path.join(publicFolder, 'unreliable.html'),
  'utf8',
)

function isMobile(headers) {
  return headers['user-agent'].includes('Mobile')
}

// set a very long retry so that the stream does not retry
fastify.register(FastifySSEPlugin, { retryDelay: 60_000 })

// https://github.com/fastify/fastify-cookie
fastify.register(require('@fastify/cookie'), {
  secret: 'my-secret-for-signing-cookies', // for cookies signature
  parseOptions: {}, // options for parsing cookies
})

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

fastify.post('/login', (request, reply) => {
  console.log('login with body %o', request.body)
  const { username, password } = request.body
  if (username === 'gleb' && password === 'network-course') {
    reply.setCookie('userName', username, {
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      signed: true,
      // do not use "secure: true" because we are on http localhost
      // secure: true,
    })
    return { ok: true }
  } else {
    console.log('invalid credentials')
    reply.code(401)
  }
})

fastify.get('/', (request, reply) => {
  console.log('request.headers %o', request.headers)
  console.log('request cookies %o', request.cookies)

  if (request.cookies.userName) {
    const decodedUserName = request.unsignCookie(request.cookies.userName)
    if (decodedUserName.valid) {
      const userName = decodedUserName.value
      if (userName) {
        console.log('/ has user name cookie value "%s"', userName)
        const userPage = indexDoc.replace(
          '<h1>Fastify Example</h1>',
          `<h1>Fastify Example for ${userName}</h1>`,
        )
        return reply.type('text/html').send(userPage)
      }
    }
  }

  if (isMobile(request.headers)) {
    reply.type('text/html').send(indexMobileDoc)
  } else {
    reply.type('text/html').send(indexDoc)
  }
})

let unreliableCount = 0
fastify.post('/unreliable', (request, reply) => {
  console.log('reset unreliable count to 0')
  unreliableCount = 0
  reply.send({ ok: true })
})

fastify.get('/unreliable', (request, reply) => {
  unreliableCount += 1
  if (unreliableCount > 7) {
    unreliableCount = 0
  }

  if (unreliableCount < 3) {
    console.log('unreliable attempt %d, sending an error', unreliableCount)
    reply.code(500).send('Server error')
  } else {
    console.log('unreliable attempt %d, sending the page', unreliableCount)
    reply.type('text/html').send(unreliableDoc)
  }
})

fastify.register(require('@fastify/static'), {
  root: publicFolder,
})

const fruits = ['Apples', 'Oranges', 'Bananas', 'Pears', 'Grapes']
// returns each fruit one by one, round-robin style
let index = 0

function getNextFruit() {
  const fruit = fruits[index]
  index += 1
  if (index >= fruits.length) {
    index = 0
  }
  return fruit
}

fastify.get('/fruit', async (request, reply) => {
  // simulate an occasional server error if needed
  // if (Math.random() < 0.4) {
  //   throw new Error('Something went wrong')
  // }

  const fruit = getNextFruit()
  return { fruit }
})

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

fastify.get('/fruits-sse', (req, res) => {
  res.sse(
    (async function* source() {
      for (let i = 0; i < 3; i++) {
        await sleep(2000)
        const fruit = getNextFruit()
        yield { id: String(i), data: JSON.stringify({ fruit }) }
      }
    })(),
  )
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

fastify.post('/got-fruit', (request, reply) => {
  console.log('got fruit:', request.body)
  return { ok: true }
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
