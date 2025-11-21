// grab the element with id "addition"
const additionElement = document.getElementById('addition')
// grab the element with id "num1"
const num1Element = document.getElementById('num1')
// grab the element with id "num2"
const num2Element = document.getElementById('num2')
// grab the element with id "sum"
const sumElement = document.getElementById('sum')

// fetch the number using API endpoint "/random-digit"
fetch('/random-digit')
  .then((response) => response.json())
  .then((data) => {
    if (typeof data.n !== 'number') {
      throw new Error('Invalid data format: expected a number')
    }

    // set the text content of first number to the fetched number
    num1Element.textContent = data.n

    // fetch the second number using API endpoint "/random-digit"
    fetch('/random-digit')
      .then((response) => response.json())
      .then((data) => {
        if (typeof data.n !== 'number') {
          throw new Error('Invalid data format: expected a number')
        }

        // set the text content of second number to the fetched number
        num2Element.textContent = data.n

        // compute the sum of both numbers
        const sum =
          parseInt(num1Element.textContent, 10) +
          parseInt(num2Element.textContent, 10)
        // set the text content of sum element to the computed sum
        sumElement.textContent = sum

        // once we fetch both numbers and compute their sum
        // set the class "loaded" on the addition element
        additionElement.classList.add('loaded')
      })
  })
