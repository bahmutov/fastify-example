const result = document.getElementById('answer')

function compute(operation) {
  const a = parseFloat(document.getElementById('num1').value)
  const b = parseFloat(document.getElementById('num2').value)
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
