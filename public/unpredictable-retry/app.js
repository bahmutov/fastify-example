const main = document.getElementById('main')

function tryFetch() {
  // expect the "GET /app-data" to respond with JSON
  // { serverNumber: number }
  return fetch('/app-data').then((response) => {
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    return response.json()
  })
}

function initialFetch() {
  // the page might make 1 or 2 requests
  let requests
  if (Math.random() < 0.5) {
    requests = [tryFetch()]
  } else {
    requests = [tryFetch(), tryFetch()]
  }
  return Promise.any(requests)
    .then((r) => {
      main.innerText = r.serverNumber || 'wrong number'
    })
    .catch(() => {
      main.innerHTML = `
        <div class="error">Something went wrong...</div>
        <div>
          <button id="retry">Retry</button>
        </div>
      `
      document.getElementById('retry').onclick = () => {
        tryFetch()
          .then((r) => {
            main.innerText = r.serverNumber || 'wrong number'
          })
          .catch(() => {
            main.innerHTML = '<div class="error">Still something wrong...</div>'
          })
      }
    })
}

setTimeout(() => {
  initialFetch()
}, 1000)
