var net = require('net');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var tls = require('tls.js');

var provider = tls.provider.node.create();

function Collector() {
  EventEmitter.call(this);

  this.state = tls.state.createDummy({ provider: provider });
  this.parser = tls.parser.create(this.state);
  this.framer = tls.framer.create(this.state);

  this.timeout = 2000;
  this.port = 443;

  this.connectTimeout = null;
}
util.inherits(Collector, EventEmitter);
module.exports = Collector;

Collector.prototype.collect = function collect(addr, cb) {
  var self = this;

  // Callbacks
  this.on('error', function(err) {
    if (cb)
      cb(err);
    cb = null;
  });

  this.on('cert', function(cert) {
    if (cb)
      cb(null, cert);
    cb = null;
  });

  // Socket and handlers
  this.socket = net.connect(this.port, addr, function(err) {
    if (err)
      return self.destroy(err);

    self.onConnect();
  });

  this.connectTimeout = setTimeout(function() {
    self.socket.destroy(new Error('Timed out'));
  }, this.timeout);

  this.socket.setTimeout(this.timeout);
  this.socket.once('error', function(err) {
    self.destroy(err);
  });

  // ClientHello
  this.framer.pipe(this.socket);
  this.socket.pipe(this.parser);

  this.parser.on('error', function(err) {
    self.destroy(err);
  });

  this.parser.on('readable', function onReadable() {
    var record = this.read();
    if (!record)
      return;

    if (self.onRecord(record))
      this.removeListener('readable', onReadable);
  });
};

Collector.prototype.destroy = function destroy(err) {
  if (this.socket)
    this.socket.destroy();
  this.socket = null;
  clearTimeout(this.connectTimeout);

  if (err)
    this.emit('error', err);
};

Collector.prototype.onConnect = function onConnect() {
  clearTimeout(this.connectTimeout);

  this.framer.hello('client', {
    cipherSuites: [
      'TLS_RSA_WITH_AES_256_CBC_SHA'
    ],
    compressionMethods: ['null'],
    extensions: []
  });
};

Collector.prototype.onRecord = function onRecord(record) {
  if (record.type !== 'handshake')
    return false;
  if (record.handshakeType !== 'certificate')
    return false;

  if (record.certs.length >= 1) {
    this.emit('cert', record.certs[0]);
    this.destroy();
  } else {
    this.destroy(new Error('No certs!'));
  }

  return true;
};
