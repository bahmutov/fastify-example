function getFruit() {
  fetch('/fruit', {
    headers: {
      'x-requesting': 'fruit',
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }
      return response.json()
    })
    .then((data) => {
      document.getElementById('fruit').innerText = data.fruit
    })
    .catch((err) => {
      console.error('error fetching fruit')
      console.error(err)
      document.getElementById('fruit').innerText = err.message
    })
}
