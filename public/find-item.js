document.getElementById('item-text').addEventListener('change', (e) => {
  const text = e.target.value
  if (text.length < 3) {
    return
  }
  console.log('looking for "%s"', text)
  document.getElementById('output').innerHTML = '<div>Looking...</div>'
  fetch('/find-item/' + encodeURIComponent(text)).then((r) => {
    if (r.ok) {
      return r
        .json()
        .then((j) => j.found)
        .then((item) => {
          document.getElementById('output').innerHTML = `
                  <div>${item.name} price <span class="price">$${item.price}</span></div>
                `
        })
    } else {
      document.getElementById('output').innerHTML = `
              <div class="not-found">Nothing found</div>
            `
    }
  })
})
