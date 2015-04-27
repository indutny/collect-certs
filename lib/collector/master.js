var cluster = require('cluster');
var levelup = require('levelup');
var crypto = require('crypto');
var util = require('util');

var Buffer = require('buffer').Buffer;
var EventEmitter = require('events').EventEmitter;

var rfc3280 = require('asn1.js-rfc3280');

function Master(options) {
  EventEmitter.call(this);

  this.options = options || {};
  this.prefix = {
    addr: 'addr/',
    cert: 'cert/'
  };

  this.db = levelup(this.options.db);

  this.workerCount = this.options.workers;
  this.workers = [];

  for (var i = 0; i < this.workerCount; i++)
    this.fork();
}
util.inherits(Master, EventEmitter);
module.exports = Master;

Master.prototype.fork = function fork() {
  var w = cluster.fork();
  var self = this;
  this.workers.push(w);

  w.on('exit', function(code) {
    self.onWorkerExit(w, code);
  });

  w.on('message', function(msg) {
    self.onWorkerMessage(msg);
  });
};

Master.prototype.onWorkerExit = function onWorkerExit(w, code) {
  var index = this.workers.indexOf(w);
  if (index === -1)
    return;
  this.workers.splice(index, 1);
  this.fork();
};

Master.prototype.onWorkerMessage = function onWorkerMessage(msg) {
  if (msg.type === 'cert')
    return this.onCert(msg.data);
};

Master.prototype.onCert = function onCert(info) {
  var self = this;

  var addr = info.addr;
  var cert = new Buffer(addr, 'base64');
  var hash = crypto.createHash('sha256').update(cert).digest('hex');

  try {
    cert = rfc3280.Certificate.decode(cert, 'der');
  } catch (e) {
    return this.emit('log', err);
  }

  // Addr-to-cert mapping
  var addrKey = this.prefix.addr + addr;
  this.db.put(addrKey, hash, function(err) {
    if (err)
      return self.emit('log', err);
  });

  // Cert itself
  var certKey = this.prefix.cert + hash;
  this.db.get(certKey, function(err) {
    // Certificate already in store
    if (!err)
      return;

    self.db.put(certKey, JSON.stringify(cert), function(err) {
      if (err)
        return self.emit('log', err);

      self.emit('cert', cert);
    });
  });
};
