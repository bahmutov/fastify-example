const { stripIndent } = require('common-tags')
const humanizeDuration = require('humanize-duration')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const FastifySSEPlugin = require('fastify-sse-v2')
const { buildEtag } = require('./src/etag')
// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })

// https://github.com/fastify/fastify-formbody
fastify.register(require('@fastify/formbody'))

// https://github.com/fastify/fastify-multipart
fastify.register(require('@fastify/multipart'), {
  limits: {
    fieldNameSize: 100, // Max field name size in bytes
    fieldSize: 100, // Max field value size in bytes
    fields: 10, // Max number of non-file fields
    fileSize: 1000000, // For multipart forms, the max file size in bytes
    files: 2, // Max number of file fields
    headerPairs: 2000, // Max number of header key=>value pairs
  },
})

// https://www.npmjs.com/package/@fastify/basic-auth
fastify.register(require('@fastify/basic-auth'), {
  validate: basicAuthValidate,
  authenticate: true,
})

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
const csrfDoc = fs.readFileSync(
  path.join(publicFolder, 'csrf-form.html'),
  'utf8',
)
const csrfCookieDoc = fs.readFileSync(
  path.join(publicFolder, 'csrf-form-cookie.html'),
  'utf8',
)
const tigerImage = fs.readFileSync(path.join(publicFolder, 'tiger.png'))

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

// https://github.com/fastify/csrf-protection
fastify.register(require('@fastify/csrf-protection'))

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
        '🎩 %s: %s %s %s',
        key,
        request.headers[key],
        request.method,
        request.url,
      )
    }
  })
  done()
})

fastify.get('/click.js', async (request, reply) => {
  await sleep(2000)
  reply.type('text/javascript').send(clickJs)
})

fastify.get('/fail-first/:count', (request) => {
  const { count } = request.params
  console.log('fail-first %d', count)
  if (count > 4) {
    return { ok: true }
  } else {
    throw new Error('fail-first')
  }
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

// CSRF form protected by the hidden input field

// current CSRF tokens
const csrfTokens = {}

fastify.get('/csrf-form.html', (request, reply) => {
  const csrfToken = crypto.randomBytes(32).toString('hex')
  console.log('sending csrf-form.html page with CSRF token %s', csrfToken)
  csrfTokens[csrfToken] = true
  const html = csrfDoc.replace('%%CSRF_TOKEN_HERE%%', csrfToken)
  return reply.type('text/html').send(html)
})

fastify.post('/submit-csrf-form', (request, reply) => {
  console.log('submit-csrf-form %o', request.body)
  const { username, csrf } = request.body
  if (!csrf) {
    const message = 'Bad or missing CSRF value'
    console.error(message)
    return reply.code(403, message).type('text/html').send(stripIndent`
      <body data-cy="error">
        ${message}
      </body>
    `)
  }
  if (!csrfTokens[csrf]) {
    const message = 'Invalid CSRF value'
    console.error(message)
    return reply.code(403, message).type('text/html').send(stripIndent`
      <body data-cy="error">
        ${message}
      </body>
    `)
  }
  console.log('valid CSRF token %s', csrf)
  // remove the used up CSRF token to prevent multiple submissions
  delete csrfTokens[csrf]

  const registeredPage = stripIndent`
    <body>
      <p>Registered user <b data-cy="username">${username}</b>
    </body>
  `

  return reply.type('text/html').send(registeredPage)
})

// CSRF form protected by CSRF cookie

fastify.route({
  method: 'GET',
  path: '/csrf-form-cookie.html',
  handler: async (request, reply) => {
    const token = await reply.generateCsrf()
    console.log('returning csrf-form-cookie.html with token', token)
    return reply.type('text/html').send(csrfCookieDoc)
  },
})

fastify.route({
  method: 'POST',
  path: '/submit-csrf-form-cookie',
  onRequest: fastify.csrfProtection,
  handler: (request, reply) => {
    const { username } = request.body
    const csrf = request.cookies._csrf
    if (!csrf) {
      const message = 'Bad or missing CSRF value'
      console.error(message)
      return reply.code(403, message).type('text/html').send(stripIndent`
      <body data-cy="error">
        ${message}
      </body>
    `)
    }

    console.log('POST /submit-csrf-form %s', username)
    const registeredPage = stripIndent`
    <body>
      <p>Registered user <b data-cy="username">${username}</b>
    </body>
  `

    return reply.type('text/html').send(registeredPage)
  },
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

fastify.get('/delay/:ms', (request, reply) => {
  console.log('request params %o', request.params)
  const ms = parseInt(request.params.ms || 1000)
  console.log('delay response by %d ms', ms)

  const result = { ok: true }

  const failProbabilityStr = request.headers['x-fail-probability']
  if (failProbabilityStr) {
    const failProbability = parseFloat(failProbabilityStr)
    if (!isNaN(failProbability)) {
      console.log('request fail probability %d', failProbability)
      if (Math.random() < failProbability) {
        console.log('will fail the request 🚨')
        result.ok = false
      }
    }
  }

  setTimeout(() => {
    console.log('sending after delay %d', ms)
    reply.send(result)
  }, ms)
})

fastify.post('/slow/:id', (request, reply) => {
  console.log('server is slowing processing request %s 🐢', request.params.id)
  setTimeout(() => {
    console.log('sending the slow response %s', request.params.id)
    reply.send({ ok: true, id: request.params.id })
  }, 10_000)
})

fastify.post('/analytics', (request, reply) => {
  reply.send({ ok: true })
})

fastify.get('/sorted', (request, reply) => {
  console.log('/sorted with the following query')
  console.log(request.query)
  reply.send({ query: request.query })
})

fastify.post('/create-user', (request, reply) => {
  const userId = request.body.userId
  console.log('creating user with id %s', userId)
  const shouldFail = Math.random() < 0.2
  if (shouldFail) {
    console.log('❌ failed to create user %s', userId)
    return reply.send({ error: 'Failed to create user' })
  }

  const shouldWait = Math.random() < 0.9
  if (shouldWait) {
    console.log('🕰️ Still waiting to create user %s', userId)
    return reply.send({ userId, data: 'creating...' })
  }

  console.log('✅ created user %s', userId)
  return reply.send({ userId, data: 'created' })
})

fastify.get('/with-cookie', (request, reply) => {
  // fastify send the reply with HTML document
  // and a cookie set
  reply.setCookie('custom-page-cookie', 'abc1234', {
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    signed: false,
    // do not use "secure: true" because we are on http localhost
    // secure: true,
  })

  const filename = path.join(publicFolder, 'with-cookie.html')
  const html = fs.readFileSync(filename, 'utf-8')
  return reply.type('text/html').send(html)
})

fastify.get('/api/with-cookie', (request, reply) => {
  console.log('api/with-cookie with the following cookies')
  console.log(request.cookies)
  console.log('and the headers')
  console.log(request.headers)

  if (request.cookies['custom-page-cookie'] !== 'abc1234') {
    console.log('🛑 cookie is missing or invalid')
    return reply.code(401).send({ error: 'Unauthorized' })
  }
  if (request.headers['x-api-key'] !== 'App custom key') {
    console.log('🛑 api key is missing or invalid')
    return reply.code(401).send({ error: 'Unauthorized' })
  }

  return reply.send({ ok: true })
})

// all other default static HTML files
fastify.register(require('@fastify/static'), {
  root: publicFolder,
})

const fruits = ['Apples', 'Oranges', 'Bananas', 'Pears', 'Grapes']
const prices = [1.99, 2.59, 1.29, 2.99, 2.89]
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

fastify.get('/fruits/price/:fruit', async (request, reply) => {
  console.log('returning price for %s', request.params.fruit)
  const index = fruits.findIndex((fruit) => fruit === request.params.fruit)
  if (index < 0) {
    console.log('could not find fruit', request.params.fruit)
    return reply.code(404).send()
  }
  const body = { fruit: request.params.fruit, price: prices[index] }
  console.log(body)
  return body
})

// this response never finishes
fastify.get('/fruit-long', (request, reply) => {})

// cached list of todos
const todos = [
  {
    id: '8166',
    title: 'Write code',
    completed: false,
  },
]
fastify.route({
  method: 'GET',
  path: '/todos',
  onSend: buildEtag(),
  handler(req, reply) {
    console.log('sending todos')
    return todos
  },
})
fastify.post('/todos', (request, reply) => {
  console.log('adding new todo', request.body)
  reply.status(201)
})

// JSON api endpoint
fastify.get('/api-jsonp', (request, reply) => {
  console.log(request.query)
  const callbackName = request.query.callback
  if (!callbackName) {
    throw new Error('Missing JSONP callback name')
  }

  const list = [
    {
      name: 'Joe',
    },
    {
      name: 'Mary',
    },
  ]
  const jsText = `
    ${callbackName}(${JSON.stringify(list)})
  `

  reply
    .header('content-type', 'application/x-javascript; charset=utf-8')
    .send(jsText)
})

// simply returns the object with all request headers
fastify.get('/headers', (request, reply) => {
  console.log('returning headers, here are the request headers')
  console.log(request.headers)
  return request.headers
})

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

fastify.options('/random-digit', (request, reply) => {
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  reply.header('Access-Control-Allow-Headers', '*')
  return {}
})

fastify.get('/random-digit', (request, reply) => {
  const n = parseInt(String(Math.random()).slice(2, 3))
  const delay = Number(request.headers['x-delay'])
  if (isNaN(delay)) {
    console.log('returning random digit %d', n)
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Access-Control-Allow-Methods', 'GET')
    return {
      n,
    }
  } else {
    console.log('will return random digit %d after %dms', n, delay)
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
    setTimeout(() => {
      reply.send({ n })
    }, delay)
  }
})

fastify.get('/random-float', (request, reply) => {
  const n = Math.random()
  console.log('returning random float %o', n)
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Methods', 'GET')
  return {
    n,
  }
})

fastify.get('/tiger-octet', (request, reply) => {
  return reply
    .header('content-type', 'application/octet-stream')
    .send(tigerImage)
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

const items = []

fastify.post('/add-item', (req, reply) => {
  const item = {
    name: req.body['item-name'],
    price: parseInt(req.body.price),
  }

  console.log('adding item request %o', item)
  reply.type('text/html').send(stripIndent`
    <body>
      <h3>${req.body['item-name']} will be added</h3>
      <p>It might take a few minutes for the item to be added and indexed</p>
      <p><a href="/items.html">Add another item</a></p>
    </body>
  `)

  // for real
  const maxDelay = 59_000
  // during development
  // const maxDelay = 1_000

  const addingDelay =
    'delay' in req.body ? Number(req.body.delay) : Math.random() * maxDelay

  console.log(
    'will add %o to the database after %s',
    item,
    humanizeDuration(addingDelay, { round: true }),
  )
  setTimeout(() => {
    console.log('adding the item %o to the database', item)
    items.push(item)

    const scrapingDelay =
      'delay' in req.body ? Number(req.body.delay) : Math.random() * maxDelay
    console.log(
      'will scrape the item %o after %s so it can be found',
      item,
      humanizeDuration(scrapingDelay, { round: true }),
    )
    setTimeout(() => {
      console.log('scraping the item %o into the search service', item)
      item.scraped = true
    }, scrapingDelay)
  }, addingDelay)
})

fastify.post('/add-item-flaky', (req, reply) => {
  const item = {
    name: req.body['item-name'],
    price: parseInt(req.body.price),
  }

  console.log('flaky adding item request %o', item)
  reply.type('text/html').send(stripIndent`
    <body>
      <h3>${req.body['item-name']} will be added</h3>
      <p>It might take a few minutes for the item to be added and indexed</p>
    </body>
  `)

  const failedToAdd = Math.random() < 0.3
  if (failedToAdd) {
    console.log('❌ failed to add the item %o', item)
    return
  }

  const maxDelay = 29_000
  const addingDelay = Math.random() * maxDelay

  console.log(
    'will add item %o to the database after %s',
    item,
    humanizeDuration(addingDelay, { round: true }),
  )
  setTimeout(() => {
    console.log('adding the item %o to the database', item)
    items.push(item)
  }, addingDelay)
})

fastify.get('/items/:name', (req, reply) => {
  console.log('fetching the item with name "%s"', req.params.name)

  const item = items.find((item) => item.name === req.params.name)
  if (!item) {
    return reply.type('text/html').code(404).send(stripIndent`
        <body>
          <h3>Item not found</h3>
          <p>Cannot find item with name "${req.params.name}</p>
        </body>
      `)
  }

  reply.type('text/html').send(stripIndent`
    <body>
      <h3>${item.name}</h3>
      <p>Price ${item.price}</p>
    </body>
  `)
})

fastify.get('/find-item/:name/price', (req, reply) => {
  console.log('fetching the item\'s price for "%s"', req.params.name)

  const item = items.find((item) => item.name === req.params.name)
  if (!item) {
    return reply.type('text/html').code(404).send(stripIndent`
        <body>
          <h3>Item not found</h3>
          <p>Cannot find item with name "${req.params.name}</p>
        </body>
      `)
  }

  reply.send({ price: item.price })
})

fastify.get('/find-item/:text', (req, reply) => {
  console.log('finding item "%s"', req.params.text)
  // only search the scraped items
  const item = items
    .filter((item) => item.scraped)
    .find((item) => item.name.includes(req.params.text))
  if (!item) {
    return reply.code(404).send({ found: null })
  }

  console.log('✅ found it "%s"', item.name)
  reply.send({ found: item })
})

fastify.post('/submit-text', async (req, reply) => {
  console.log('received text submission')
  console.log(req.body)
  // generate the HTML response page
  reply.type('text/html').send(stripIndent`
    <body>
      <h3>Thank you for your submission</h3>
      <pre>${req.body}</pre>
    </body>
  `)
})

fastify.post('/submit-urlencoded', async (req, reply) => {
  const values = req.body
  console.log('received values %o', values)
  // generate the HTML response page
  reply.type('text/html').send(stripIndent`
    <body>
      <h3>Thank you for your submission</h3>
      <p>You entered ${Object.entries(values)
        .map(([name, value]) => `<span data-${name}>${value}</span>`)
        .join(', ')}</p>
    </body>
  `)
})

fastify.post('/submit-form', async (req, reply) => {
  const parts = req.parts()
  const values = {}
  for await (const part of parts) {
    if (part.file) {
      console.log('file', part.filename)
    } else {
      values[part.fieldname] = part.value
      console.log('%s=%s', part.fieldname, part.value)
    }
  }

  reply.type('text/html').send(stripIndent`
    <body>
      <h3>Thank you for your submission</h3>
      <p>You entered ${Object.entries(values)
        .map(([name, value]) => `<span data-${name}>${value}</span>`)
        .join(', ')}</p>
    </body>
  `)
})

fastify.post('/upload-profile-picture', async (req, reply) => {
  const data = await req.file()
  console.log('file', data.mimetype, data.filename)
  const buf = await data.toBuffer()
  const base64 = buf.toString('base64')
  const src = `data:${data.mimetype};base64,${base64}`

  const values = {
    username: 'test',
  }
  console.log('sending upload profile picture response')
  reply.type('text/html').send(stripIndent`
    <body>
      <h3>Updated profile picture for <span data-username>${values.username}</span></h3>
      <p>
        <img src="${src}" alt="Profile picture" />
      </p>
    </body>
  `)
})

fastify.post('/upload-json-file', async (req, reply) => {
  const data = await req.file()
  console.log('file', data.mimetype, data.filename)
  const buf = await data.toBuffer()
  const str = buf.toString()
  const json = JSON.parse(str)
  console.log('=== uploaded JSON ===')
  console.log(json)

  reply.type('text/html').send(stripIndent`
    <body>
      <h2>Uploaded JSON file</h3>
      <h3 data-cy="filename">${data.filename}</h2>
      <code><pre>${str}</pre></code>
    </body>
  `)
})

fastify.post('/upload-files', async (req, reply) => {
  const parts = req.files()

  const uploadedJsonFiles = []
  for await (const part of parts) {
    console.log('file', part.mimetype, part.filename)
    const buf = await part.toBuffer()
    if (part.mimetype === 'application/json') {
      const str = buf.toString()
      console.log('raw string:', str)
      const json = JSON.parse(str)
      console.log('=== uploaded JSON ===')
      console.log(json)
      uploadedJsonFiles.push({
        filename: part.filename,
        str,
        json,
      })
    }
  }

  console.log('sending html')
  reply.type('text/html').send(stripIndent`
    <body>
      <h2>Uploaded ${uploadedJsonFiles.length} JSON files</h3>
      <ol>
        ${uploadedJsonFiles.map(
          (part) => stripIndent`
          <li data-cy="file">
            <h3 data-cy="filename">${part.filename}</h2>
            <code><pre>${part.str}</pre></code>
          </li>
        `,
        )}
      </ol>
    </body>
  `)
})

// several redirects
fastify.get('/short-url', (request, reply) => {
  reply.redirect('/helper-shortener')
})
fastify.get('/helper-shortener', (request, reply) => {
  reply.redirect('/server-page')
})
fastify.get('/server-page', (request, reply) => {
  reply.redirect('/redirected.html')
})

// search "results" used for Bonus 116 lesson
fastify.get('/api/search/:text', (req, reply) => {
  console.log('search suggestions for "%s"', req.params.text)
  if (req.params.text.length === 1) {
    console.log('returning 7 results')
    return reply.send({
      search: req.params.text,
      suggestions: ['one', 'two', 'three', 'four', 'five', 'six', 'seven'],
    })
  }
  if (req.params.text.length === 2) {
    console.log('returning 4 results')
    return reply.send({
      search: req.params.text,
      suggestions: ['one', 'two', 'three', 'four'],
    })
  }
  if (req.params.text.length === 3) {
    console.log('returning 2 results')
    return reply.send({
      search: req.params.text,
      suggestions: ['one', 'two'],
    })
  }

  console.log('returning an empty list')
  return reply.send({
    search: req.params.text,
    suggestions: [],
  })
})

// https://www.npmjs.com/package/@fastify/basic-auth
function basicAuthValidate(username, password, req, reply, done) {
  console.log('checking basic auth %s:%s', username, password)
  if (username === 'test_cy' && password === 'secure12$1') {
    done()
  } else {
    done(new Error('Wrong basic auth'))
  }
}

fastify.after(() => {
  fastify.route({
    method: 'GET',
    url: '/protected',
    onRequest: fastify.basicAuth,
    handler: async (req, reply) => {
      console.log('sending protected page')
      return reply.type('text/html').send(stripIndent`
        <body>
          <h1>Secret stuff</h1>
        </body>
      `)
    },
  })
})

function getRoundedDate(d, minutes = 1) {
  const ms = 1000 * 60 * minutes // convert minutes to ms
  const roundedDate = new Date(Math.round(d.getTime() / ms) * ms)
  return roundedDate
}

function getDateString(d) {
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

// replies with the page with UTC timestamp rounded to a minute
// includes the precise timestamp in the response header "x-time-check"
fastify.get('/time-check', (req, reply) => {
  const time = new Date()
  const timeString = time.toUTCString()
  const roundedTime = getRoundedDate(time)
  const roundedString = getDateString(roundedTime)
  console.log('time check %s', timeString)
  console.log('rounded time %s', roundedString)

  reply.type('text/html').header('x-time-check', timeString).send(stripIndent`
    <body>
      <h2>Time Check</h3>
      <span data-cy="time">${roundedString}</span> GMT
    </body>
  `)
})

// Run the server!
const start = async () => {
  try {
    await fastify.listen({ port: 4200 })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()

async function closeServer(signal) {
  console.log(`closing the server with the signal ${signal}`)
  await fastify.close()
  process.kill(process.pid, signal)
}
process.once('SIGINT', closeServer)
process.once('SIGTERM', closeServer)
