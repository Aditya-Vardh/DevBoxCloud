/**
 * DevBox Sample Application
 * A minimal HTTP server for end-to-end testing of the DevBox platform.
 * Listens on port 8080, returns a JSON response.
 */
const http = require('http')
const port = parseInt(process.env.PORT || '8080', 10)

const server = http.createServer((req, res) => {
  const body = JSON.stringify({
    message: 'Hello from DevBox Sample App!',
    path: req.url,
    timestamp: new Date().toISOString(),
    hostname: require('os').hostname(),
  })
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
})

server.listen(port, () => {
  console.log(`Sample app listening on port ${port}`)
})
