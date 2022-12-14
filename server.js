const { stripIndent } = require('common-tags')
const humanizeDuration = require('humanize-duration')
const path = require('path')
const fs = require('fs')
const FastifySSEPlugin = require('fastify-sse-v2')
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
  await sleep(2000)
  reply.type('text/javascript').send(clickJs)
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

fastify.get('/random-digit', (request, reply) => {
  const n = parseInt(String(Math.random()).slice(2, 3))
  console.log('returning random digit %d', n)
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

  const addingDelay = Math.random() * maxDelay
  console.log(
    'will add %o to the database after %s',
    item,
    humanizeDuration(addingDelay, { round: true }),
  )
  setTimeout(() => {
    console.log('adding the item %o to the database', item)
    items.push(item)

    const scrapingDelay = Math.random() * maxDelay
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
