/*
filedrag.js - HTML5 File Drag & Drop demonstration
Featured on SitePoint.com
Developed by Craig Buckler (@craigbuckler) of OptimalWorks.net
*/
;(function () {
  // getElementById
  function $id(id) {
    return document.getElementById(id)
  }

  // output information
  function Output(msg) {
    var m = $id('messages')
    m.innerHTML = msg + m.innerHTML
  }

  // file drag hover
  function FileDragHover(e) {
    console.log('draghover', e.type, e.target)
    e.stopPropagation()
    e.preventDefault()
    e.target.className = e.type == 'dragover' ? 'hover' : ''
  }

  // file selection
  function FileSelectHandler(e) {
    console.log(e)
    // cancel event and hover styling
    FileDragHover(e)

    // fetch FileList object
    var files = e.target.files || e.dataTransfer.files
    console.log(files)

    // process all File objects
    for (var i = 0, f; (f = files[i]); i++) {
      ParseFile(f)
    }
  }

  function FileDropHandler(e) {
    console.log(e)
    // cancel event and hover styling
    FileDragHover(e)

    // fetch FileList object
    const files = e.dataTransfer.files
    console.log(files)

    const fileselect = $id('fileselect')
    fileselect.files = files

    // process all File objects
    for (var i = 0, f; (f = files[i]); i++) {
      ParseFile(f)
    }
  }

  // output file information
  function ParseFile(file) {
    Output(
      '<p data-cy="file-info">File information: <strong data-cy="filename">' +
        file.name +
        '</strong> type: <strong data-cy="type">' +
        file.type +
        '</strong> size: <strong data-cy="size">' +
        file.size +
        '</strong> bytes</p>',
    )
  }

  // initialize
  function Init() {
    var fileselect = $id('fileselect'),
      filedrag = $id('filedrag'),
      submitbutton = $id('submitbutton')

    // file select
    fileselect.addEventListener('change', FileSelectHandler, false)

    // is XHR2 available?
    var xhr = new XMLHttpRequest()
    if (xhr.upload) {
      // file drop
      filedrag.addEventListener('dragover', FileDragHover, false)
      filedrag.addEventListener('dragleave', FileDragHover, false)
      filedrag.addEventListener('drop', FileDropHandler, false)
      filedrag.style.display = 'block'

      // remove submit button
      submitbutton.style.display = 'none'
    }
  }

  // call initialization file
  if (window.File && window.FileList && window.FileReader) {
    Init()
  }
})()
