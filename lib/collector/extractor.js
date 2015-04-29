var asn1 = require('asn1.js');
var rfc3280 = require('asn1.js-rfc3280');
var Buffer = require('buffer').Buffer;
var geoip = require('geoip-lite');

var pubKeyOID = {
  // rsa
  '1.2.840.113549.1.1.1': 0,
  // dsa
  '1.2.840.10040.4.1': 1,
  // ecdsa
  '1.2.840.10045.2.1': 2
};

var extOID = {
  '2.5.29.17': 'altname',
  '2.5.29.19': 'constraints'
};

function convertDate(time) {
  return time.value / 1000;
}

var RSAPublicKey = asn1.define('RSAPublicKey', function() {
  this.seq().obj(
    this.key('modulus').int(),
    this.key('publicExponent').int()
  );
});

var BasicConstraints = asn1.define('BasicConstraints', function() {
  this.seq().obj(
    this.key('cA').bool().def(false),
    this.key('pathLenConstraint').int().optional()
  );
});

var GeneralName = asn1.define('GeneralName', function() {
  this.choice({
    dNSName: this.implicit(2).ia5str()
  });
});

var GeneralNames = asn1.define('GeneralNames', function() {
  this.seqof(GeneralName);
});

exports.extract = function extract(cert, ips) {
  var raw = new Buffer(cert, 'base64');
  var cert = rfc3280.Certificate.decode(raw, 'der').tbsCertificate;

  var issuer = [];
  for (var i = 0; i < cert.issuer.value.length; i++) {
    var item = cert.issuer.value[i][0];
    if (!item)
      continue;

    if (item.type.join('.') === '2.5.4.3')
      issuer.push(item.value.slice(2));
  }
  var subject = [];
  for (var i = 0; i < cert.subject.value.length; i++) {
    var item = cert.subject.value[i][0];
    if (!item)
      continue;

    if (item.type.join('.') === '2.5.4.3')
      subject.push(item.value.slice(2));
  }

  var pubKey = pubKeyOID[
      cert.subjectPublicKeyInfo.algorithm.algorithm.join('.')];
  if (pubKey === undefined)
    pubKey = -1;

  var pubKeySize = -1;
  if (pubKey === 0) {
    try {
      var key = RSAPublicKey.decode(
          cert.subjectPublicKeyInfo.subjectPublicKey.data, 'der');

      pubKeySize = key.modulus.bitLength();
    } catch (e) {
      // Skip the cert
      return;
    }
  }

  var selfSigned = true;
  var exts = [];
  var altnameCount = 0;
  if (!cert.extensions)
    cert.extensions = [];
  for (var i = 0; i < cert.extensions.length; i++) {
    var ext = cert.extensions[i];
    var typeId = ext.extnID.join('.');
    var type = extOID[typeId];
    try {
      if (type === 'constraints') {
        var c = BasicConstraints.decode(ext.extnValue, 'der');
        selfSigned = c.cA;
      } else if (type === 'altname') {
        var a = GeneralNames.decode(ext.extnValue, 'der');
        altnameCount += a.length;
      }
    } catch (e) {
      // Skip the cert!
      return;
    }

    // Collect extension types!
    if (/^2\.5\.29\./.test(typeId))
      exts.push(ext.extnID.pop());
  }

  var info = [
    // X509 version
    typeof cert.version === 'string' ? (cert.version.slice(1) | 0) :
                                       cert.version,

    issuer.join('/'),
    subject.join('.'),
    selfSigned ? 1 : 0,

    // Last digit of algorithm identifies it
    // NOTE: first ones are 1.2.840.113549.1.1 for RSA
    cert.signature.algorithm.pop(),

    // Validity
    convertDate(cert.validity.notBefore),
    convertDate(cert.validity.notAfter),

    // Public Key
    pubKey,
    pubKeySize,

    // Number of alternative names
    altnameCount,

    // Extension types (last number)
    exts,

    ips.map(function(ip) {
      var loc = geoip.lookup(ip);
      if (!loc)
        return false;
      return loc.ll;
    }).filter(function(ll) {
      return ll;
    })
  ];

  return info;
};
