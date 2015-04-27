var net = require('net');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var tls = require('tls.js');

var provider = tls.provider.node.create();
var state = tls.state.createDummy({ provider: provider });

// Obtain ClientHello
var framer = tls.framer.create(state);
framer.hello('client', {
  cipherSuites: [
    'TLS_RSA_WITH_AES_256_CBC_SHA'
  ],
  compressionMethods: ['null'],
  extensions: []
});
var hello = framer.read();

function Collector() {
  EventEmitter.call(this);

  this.parser = tls.parser.create(state);

  this.timeout = 2000;
  this.port = 443;
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

  this.socket.setTimeout(this.timeout, function() {
    self.socket.destroy(new Error('Timed out'));
  });
  this.socket.once('error', function(err) {
    self.destroy(err);
  });
  this.socket.once('close', function() {
    self.destroy(new Error('Closed too early'));
  });

  // ClientHello
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

  if (err)
    this.emit('error', err);
};

Collector.prototype.onConnect = function onConnect() {
  this.socket.write(hello);
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
