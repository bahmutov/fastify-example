// load the jQuery plugin dynamically
$.getScript('/jquery-example/src/jquery.warning.js')

// use the jQuery.warning plugin on button click
$(function () {
  $('button#warn').on('click', () => {
    $('div').warning()
    $('p').warning()
  })
})
