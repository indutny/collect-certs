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

var v = new Visualizer();

}();
