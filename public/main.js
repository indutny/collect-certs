!function() {

function Visualizer() {
  this.globe = DAT.Globe(document.getElementById('container'), {
    colorFn: function(x) {
      var c = new THREE.Color();
      c.setHSL(Math.min((Math.max(0, x - 1024) / 1024), 2.3) * 0.3, 1.0, 0.5);
      return c;
    }
  });
  this.globe.animate()

  this.loaded = {};
  this.loading = false;

  this.elems = {
    'type': {
      'private': document.getElementById('type-private'),
      'public': document.getElementById('type-public')
    },
    'size': {
      'all': document.getElementById('size-all'),
      '1024': document.getElementById('size-1024'),
      '2048': document.getElementById('size-2048'),
      '4096': document.getElementById('size-4096')
    }
  };

  this.files = {
    'private': {
      'all': 'size-private.json',
      '1024': 'size-private-1024.json',
      '2048': 'size-private-2048.json',
      '4096': 'size-private-4096.json'
    },
    'public': {
      'all': 'size-public.json',
      '1024': 'size-public-1024.json',
      '2048': 'size-public-2048.json',
      '4096': 'size-public-4096.json'
    }
  };

  this.addMouseEvents();

  this.type = 'public';
  this.size = 'all';

  this.show('public', 'all', function() {
    document.body.style.backgroundImage = 'none'; // remove loading
  });

  this.renderContent();
}

Visualizer.prototype.loadFile = function loadFile(type, size, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'public/data/size-' + type + '-' + size + '.json', true);
  xhr.onreadystatechange = function(e) {
    if (xhr.readyState !== 4)
      return;
    if (xhr.status !== 200)
      return;
    cb(JSON.parse(xhr.responseText));
  };
  xhr.send(null);
};

Visualizer.prototype.show = function show(type, size, cb) {
  // Wait for previous data to load
  if (this.loading)
    return cb(new Error('Already loading'));

  var key = type + ':' + size;
  if (!this.loaded[key]) {
    var self = this;
    this.loading = true;
    return this.loadFile(type, size, function(data) {
      self.globe.addData(data, { format: 'legend' });
      self.globe.createPoints(key);

      self.loading = false;
      self.loaded[key] = true;
      self.show(type, size, cb);
    });
  }

  this.type = type;
  this.size = size;

  // Reset the rest
  Object.keys(this.elems).forEach(function(elemType) {
    var subElems = this.elems[elemType];
    Object.keys(subElems).forEach(function(value) {
      var elem = subElems[value];
      elem.className = elemType + '-item';
    });
  }, this);

  this.elems.type[type].className = 'type-item active';
  this.elems.size[size].className = 'size-item active';

  this.globe.showPoints(key);
  cb();
};

Visualizer.prototype.addMouseEvents = function addMouseEvents() {
  var self = this;

  Object.keys(this.elems).forEach(function(elemType) {
    var subElems = this.elems[elemType];
    Object.keys(subElems).forEach(function(value) {
      var elem = subElems[value];

      var type = elemType === 'type' ? value : undefined;
      var size = elemType === 'size' ? value : undefined;

      console.log(value);
      elem.addEventListener('click', function() {
        self.show(type || self.type, size || self.size, function() {
          // No-op
        });
      }, false);
    });
  }, this);
};

Visualizer.prototype.renderContent = function renderContent() {
  var signatureByOID = {
    2: 'md2',
    3: 'md4',
    4: 'md5',
    5: 'sha1',
    6: 'dsi',
    11: 'sha256',
    12: 'sha384',
    13: 'sha512',
    14: 'sha224'
  };

  // TODO(indutny): it could be potentially stored on server
  var stats = [
    ['Top 10 CAs per server', [
      ["Verizon Akamai SureServer CA G14-SHA1",256634],
       ["GeoTrust SSL CA",136182],
       ["GeoTrust SSL CA - G4",67071],
       ["Go Daddy Secure Certificate Authority - G2",58501],
       ["Verizon Akamai SureServer CA G14-SHA2",55009],
       ["COMODO RSA Domain Validation Secure Server CA",51108],
       ["RapidSSL CA",45884],
       ["VeriSign Class 3 Secure Server CA - G3",39427],
       ["COMODO SSL CA",34385],
       ["Jungo CA",32981]
    ]],
    ['Number of altnames in cert per server', [
      [1,509904],[2,485952],[0,141584],[3,35375],[5,33519],
      [4,23453],[11,20288],[6,18813],[7,10284],[8,9296]
    ]],
    ['Signature type in cert per server', [
      [5,899381],[11,495899],[4,19186],[13,680],
      [3,164],[12,20],[2,4]
    ].map(function(item) {
      return [ signatureByOID[item[0]], item[1] ]
    })]
  ];

  var content = document.getElementById('content');

  var html = '';
  stats.forEach(function(item) {
    var title = item[0];
    var data = item[1];

    html += '<h3>' + title + '</h3>';
    html += '<ol>';
    for (var i = 0; i < data.length; i++) {
      html += '<li>' + data[i][0] +
              '<span class="stat-count"> / ' + data[i][1] +'</span>' +
              '</li>';
    }
    html += '</ol>';
  });

  content.innerHTML = html;
};

var v = new Visualizer();

}();
