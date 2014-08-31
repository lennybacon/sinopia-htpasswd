var crypto = require('crypto')

try {
  // optional, won't be available on windows
  var crypt3 = require('crypt3')
} catch(err) {
  crypt3 = function() {
    return NaN
  }
}

try {
  var fsExt = require('fs-ext')
} catch(e) {
  fsExt = {
    flock: function() {
      arguments[arguments.length-1]()
    }
  }
}

// this function neither unlocks file nor closes it
// it'll have to be done manually later
function lock_and_read(name, callback) {
  open_flock(name, 'r', 'exnb', 4, 10, function(err, fd) {
    if (err) return callback(err, fd)

    fs.fstat(fd, function(err, st) {
      if (err) return callback(err, fd)

      var buffer = new Buffer(st.size)
      fs.read(fd, buffer, 0, st.size, null, function(err, bytesRead, buffer) {
        if (err) return callback(err)
        if (bytesRead != st.size) return callback(new Error('st.size != bytesRead'), fd)

        callback(null, fd, buffer)
      })
    })
  })
}

function parse_htpasswd(input) {
  var result = {}
  input.split('\n').forEach(function(line) {
    var args = line.split(':', 3)
    if (args.length > 1) result[args[0]] = args[1]
  })
  return result
}

function verify_password(user, passwd, hash) {
  if (hash.indexOf('{PLAIN}') === 0) {
    return passwd === hash.substr(7)
  } else if (hash.indexOf('{SHA}') === 0) {
    return crypto.createHash('sha1').update(passwd, 'binary').digest('base64') === hash.substr(5)
  } else {
    return crypt3(passwd, hash) === hash
  }
}

function add_user_to_htpasswd(body, user, passwd) {
  if (user != encodeURIComponent(user)) {
    var err = Error("username shouldn't contain non-uri-safe characters")
    err.status = 409
    throw err
  }

  passwd = crypt3(passwd)
  if (!passwd) {
    passwd = '{SHA}' + crypto.createHash('sha1').update(passwd, 'binary').digest('base64')
  }
  var comment = 'autocreated ' + (new Date()).toJSON()

  var newline = user + ':' + passwd + ':' + comment + '\n'
  if (body.length && body[body.length-1] != '\n') newline = '\n' + newline
  return body + newline
}

module.exports.parse_htpasswd = parse_htpasswd
module.exports.verify_password = verify_password
module.exports.add_user_to_htpasswd = add_user_to_htpasswd
module.exports.lock_and_read = lock_and_read
