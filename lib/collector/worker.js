var Collector = require('../collector').Collector;

var fs = require('fs');
var path = require('path');

function Worker(options) {
  this.options = options || {};

  this.parallel = this.options.parallel;
  for (var i = 0; i < this.parallel; i++)
    this.fetch(i);
}
module.exports = Worker;

Worker.prototype.fetch = function fetch(id) {
  var raw = Math.random() * 0xffffffff;
  var addr = '';
  for (var i = 0; i < 3; i++, raw >>>= 8)
    addr += (raw & 0xff) + '.';
  addr += raw;

  var self = this;
  var c = new Collector();
  c.collect(addr, function(err, cert) {
    if (err)
      return self.fetch(id);

    process.nextTick(function() {
      self.sendCert(addr, cert);
    });
    self.fetch(id);
  });
}

Worker.prototype.sendCert = function sendCert(addr, cert) {
  process.send({
    type: 'cert',
    data: {
      addr: addr,
      cert: cert.toString('base64')
    }
  });
};
