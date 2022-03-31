// this JS file should load after "app.js"
// and it loads the "click.js" that really registers the event listener
setTimeout(function () {
  const script = document.createElement('script')
  script.src = 'click.js'
  document.body.appendChild(script)
}, 1000)
