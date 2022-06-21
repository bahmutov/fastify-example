const result = document.getElementById('answer')

function trackEvent(eventName, args = {}) {
  fetch('/track', {
    method: 'POST',
    body: JSON.stringify({
      eventName,
      args,
    }),
    headers: {
      'content-type': 'application/json',
    },
  })
}

trackEvent('load')
// maybe fire another event
if (Math.random() < 0.5) {
  setTimeout(() => {
    trackEvent('user')
  }, 20)
}
// maybe fire another event
if (Math.random() < 0.5) {
  setTimeout(() => {
    trackEvent('analytics')
  }, 20)
}

function compute(operation) {
  const errors = document.querySelector('.errors')
  errors.innerText = ''
  if (document.getElementById('num1').value === '') {
    errors.innerText = 'Missing the first number'
    return
  }
  if (document.getElementById('num2').value === '') {
    errors.innerText = 'Missing the second number'
    return
  }
  const a = parseFloat(document.getElementById('num1').value)
  const b = parseFloat(document.getElementById('num2').value)
  trackEvent(operation, { a, b })
  result.innerText = 'computing'
  fetch('/calculate', {
    method: 'POST',
    body: JSON.stringify({
      a,
      b,
      operation,
    }),
    headers: {
      'content-type': 'application/json',
    },
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.error) {
        result.innerText = data.error + '\n' + data.message
      } else {
        result.innerText = data.answer
      }
    })
}

document.getElementById('add').addEventListener('click', function () {
  compute('+')
})

document.getElementById('sub').addEventListener('click', function () {
  compute('-')
})

document.getElementById('mul').addEventListener('click', function () {
  compute('*')
})
