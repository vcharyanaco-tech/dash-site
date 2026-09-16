const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { password } = require('./test-bootstrap');
const { server } = require('../index');

let port;

before(async function () {
  await new Promise(function (resolve) {
    server.listen(0, function () {
      port = server.address().port;
      resolve();
    });
  });
});

after(function () {
  server.close();
});

test('login issues an HttpOnly session cookie and cookie auth works without a token argument', async function () {
  const loginResponse = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      function: 'login',
      args: ['vcharyanaco@gmail.com', password]
    })
  });
  const login = await loginResponse.json();
  assert.strictEqual(login.result.success, true);
  const cookie = loginResponse.headers.get('set-cookie');
  assert.match(cookie || '', /^dash_session=[^;]+; HttpOnly;/);

  const dataResponse = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      Cookie: cookie.split(';')[0]
    },
    body: JSON.stringify({ function: 'getAppData', args: [] })
  });
  const data = await dataResponse.json();
  assert.strictEqual(data.result.user.loggedIn, true);
  assert.strictEqual(data.result.user.email, 'vcharyanaco@gmail.com');
});
