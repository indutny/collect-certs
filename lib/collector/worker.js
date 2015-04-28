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

Worker.prototype.filterIp = function filterIp(ip) {
  // Indiana University IP CIDRs, they are monitoring port scanning

  // 129.79.0.0/16
  // 140.182.0.0/16
  // 149.159.0.0/16
  // 149.161.0.0/16
  // 149.162.0.0/16
  // 149.163.0.0/16
  // 149.165.0.0/17
  // 149.165.128.0/17
  // 156.56.0.0/16
  if (/^(127\.79|156\.56|149\.165|140\.182|149\.159|149\.16[1235])\./.test(ip))
    return false;

  // 192.12.206.0/24
  // 192.203.115.0/24
  // 192.203.116.0/24
  // 198.49.177.0/24
  if (/^(198\.49\.177|192\.12\.206|192\.203\.11[56]|192\.12\.206)\./.test(ip))
    return false;

  return true;
};

Worker.prototype.fetch = function fetch(id) {
  var addr;
  do {
    var raw = Math.random() * 0xffffffff;
    addr = '';
    for (var i = 0; i < 3; i++, raw >>>= 8)
      addr += (raw & 0xff) + '.';
    addr += raw;
  } while (!this.filterIp(addr));

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
