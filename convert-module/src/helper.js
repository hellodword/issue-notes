import fr from 'follow-redirects'

const {
  http
} = fr
const {
  https
} = fr

function pad2 (n) {
  return (n < 10 ? '0' : '') + n
}

export function dateFormat (date) {
  const s = `${date.getFullYear()}-${pad2((date.getMonth() + 1))}-${pad2(date.getDate())}`
  const regex = /^\d{4}-\d{2}-\d{2}/
  if (!regex.test(s)) {
    throw (date)
  }
  return s
}

export function getPromise (link) {
  return new Promise((resolve, reject) => {
    let protocol = https
    const regex = /^http:/
    if (regex.test(link)) {
      protocol = http
    }
    protocol.get(link, (response) => {
      const data = []

      response.on('data', (fragments) => {
        data.push(fragments)
      })

      response.on('end', () => {
        resolve({
          body: Buffer.concat(data),
          response: response
        })
      })

      response.on('error', (error) => {
        reject(error)
      })
    })
  })
}
