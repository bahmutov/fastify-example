document.getElementById('item-text').addEventListener('change', (e) => {
  const text = e.target.value
  if (text.length < 3) {
    return
  }
  console.log('looking for "%s"', text)
  document.getElementById('output').innerHTML = '<div>Looking...</div>'

  const url = '/find-item/' + encodeURIComponent(text)
  const priceUrl = url + '/price'

  const f1 = fetch(url).then((r) => {
    if (r.ok) {
      return r.json().then((j) => j.found.price)
    } else {
      throw new Error(`Could not find item ${text}`)
    }
  })
  const f2 = fetch(priceUrl).then((r) => {
    if (r.ok) {
      return r.json().then((j) => j.price)
    } else {
      console.error(`Could not get price for "${text}"`)
    }
  })

  Promise.all([f1, f2])
    .then(([price1, price2]) => {
      if (price1 !== price2) {
        throw new Error(`Found price mismatch ${price1} vs ${price2}`)
      }
      document.getElementById('output').innerHTML = `
        <div class="price">$${price1}</div>
      `
    })
    .catch((err) => {
      document.getElementById('output').innerHTML = `
        <div class="not-found">${err.message}</div>
      `
    })
})
