// Service worker: pagina's en kaartgegevens offline; bezochte kaarttegels worden bewaard.
var V = 'arb-d256d574';
var CORE = ["./", "kaart/", "wandelingen/", "soorten/", "groepen/", "colofon/", "offline.html", "css/site.css", "js/kaart.js", "data/arboretum.json", "data/wandelingen.json", "img/plattegrond.svg", "manifest.webmanifest", "icoon-192.png", "wandeling/", "js/wandeling.js", "data/padgraaf.json", "lib/leaflet-1.9.4/images/layers-2x.png", "lib/leaflet-1.9.4/images/layers.png", "lib/leaflet-1.9.4/images/marker-icon-2x.png", "lib/leaflet-1.9.4/images/marker-icon.png", "lib/leaflet-1.9.4/images/marker-shadow.png", "lib/leaflet-1.9.4/leaflet-global.js", "lib/leaflet-1.9.4/leaflet.css", "lib/leaflet-1.9.4/src/Leaflet.js", "lib/leaflet-1.9.4/src/control/Control.Attribution.js", "lib/leaflet-1.9.4/src/control/Control.Layers.js", "lib/leaflet-1.9.4/src/control/Control.Scale.js", "lib/leaflet-1.9.4/src/control/Control.Zoom.js", "lib/leaflet-1.9.4/src/control/Control.js", "lib/leaflet-1.9.4/src/control/index.js", "lib/leaflet-1.9.4/src/core/Browser.js", "lib/leaflet-1.9.4/src/core/Class.js", "lib/leaflet-1.9.4/src/core/Events.js", "lib/leaflet-1.9.4/src/core/Handler.js", "lib/leaflet-1.9.4/src/core/Util.js", "lib/leaflet-1.9.4/src/core/index.js", "lib/leaflet-1.9.4/src/dom/DomEvent.DoubleTap.js", "lib/leaflet-1.9.4/src/dom/DomEvent.Pointer.js", "lib/leaflet-1.9.4/src/dom/DomEvent.js", "lib/leaflet-1.9.4/src/dom/DomUtil.js", "lib/leaflet-1.9.4/src/dom/Draggable.js", "lib/leaflet-1.9.4/src/dom/PosAnimation.js", "lib/leaflet-1.9.4/src/dom/index.js", "lib/leaflet-1.9.4/src/geo/LatLng.js", "lib/leaflet-1.9.4/src/geo/LatLngBounds.js", "lib/leaflet-1.9.4/src/geo/crs/CRS.EPSG3395.js", "lib/leaflet-1.9.4/src/geo/crs/CRS.EPSG3857.js", "lib/leaflet-1.9.4/src/geo/crs/CRS.EPSG4326.js", "lib/leaflet-1.9.4/src/geo/crs/CRS.Earth.js", "lib/leaflet-1.9.4/src/geo/crs/CRS.Simple.js", "lib/leaflet-1.9.4/src/geo/crs/CRS.js", "lib/leaflet-1.9.4/src/geo/crs/index.js", "lib/leaflet-1.9.4/src/geo/index.js", "lib/leaflet-1.9.4/src/geo/projection/Projection.LonLat.js", "lib/leaflet-1.9.4/src/geo/projection/Projection.Mercator.js", "lib/leaflet-1.9.4/src/geo/projection/Projection.SphericalMercator.js", "lib/leaflet-1.9.4/src/geo/projection/index.js", "lib/leaflet-1.9.4/src/geometry/Bounds.js", "lib/leaflet-1.9.4/src/geometry/LineUtil.js", "lib/leaflet-1.9.4/src/geometry/Point.js", "lib/leaflet-1.9.4/src/geometry/PolyUtil.js", "lib/leaflet-1.9.4/src/geometry/Transformation.js", "lib/leaflet-1.9.4/src/geometry/index.js", "lib/leaflet-1.9.4/src/layer/DivOverlay.js", "lib/leaflet-1.9.4/src/layer/FeatureGroup.js", "lib/leaflet-1.9.4/src/layer/GeoJSON.js", "lib/leaflet-1.9.4/src/layer/ImageOverlay.js", "lib/leaflet-1.9.4/src/layer/Layer.js", "lib/leaflet-1.9.4/src/layer/LayerGroup.js", "lib/leaflet-1.9.4/src/layer/Popup.js", "lib/leaflet-1.9.4/src/layer/SVGOverlay.js", "lib/leaflet-1.9.4/src/layer/Tooltip.js", "lib/leaflet-1.9.4/src/layer/VideoOverlay.js", "lib/leaflet-1.9.4/src/layer/index.js", "lib/leaflet-1.9.4/src/layer/marker/DivIcon.js", "lib/leaflet-1.9.4/src/layer/marker/Icon.Default.js", "lib/leaflet-1.9.4/src/layer/marker/Icon.js", "lib/leaflet-1.9.4/src/layer/marker/Marker.Drag.js", "lib/leaflet-1.9.4/src/layer/marker/Marker.js", "lib/leaflet-1.9.4/src/layer/marker/index.js", "lib/leaflet-1.9.4/src/layer/tile/GridLayer.js", "lib/leaflet-1.9.4/src/layer/tile/TileLayer.WMS.js", "lib/leaflet-1.9.4/src/layer/tile/TileLayer.js", "lib/leaflet-1.9.4/src/layer/tile/index.js", "lib/leaflet-1.9.4/src/layer/vector/Canvas.js", "lib/leaflet-1.9.4/src/layer/vector/Circle.js", "lib/leaflet-1.9.4/src/layer/vector/CircleMarker.js", "lib/leaflet-1.9.4/src/layer/vector/Path.js", "lib/leaflet-1.9.4/src/layer/vector/Polygon.js", "lib/leaflet-1.9.4/src/layer/vector/Polyline.js", "lib/leaflet-1.9.4/src/layer/vector/Rectangle.js", "lib/leaflet-1.9.4/src/layer/vector/Renderer.getRenderer.js", "lib/leaflet-1.9.4/src/layer/vector/Renderer.js", "lib/leaflet-1.9.4/src/layer/vector/SVG.Util.js", "lib/leaflet-1.9.4/src/layer/vector/SVG.VML.js", "lib/leaflet-1.9.4/src/layer/vector/SVG.js", "lib/leaflet-1.9.4/src/layer/vector/index.js", "lib/leaflet-1.9.4/src/map/Map.js", "lib/leaflet-1.9.4/src/map/handler/Map.BoxZoom.js", "lib/leaflet-1.9.4/src/map/handler/Map.DoubleClickZoom.js", "lib/leaflet-1.9.4/src/map/handler/Map.Drag.js", "lib/leaflet-1.9.4/src/map/handler/Map.Keyboard.js", "lib/leaflet-1.9.4/src/map/handler/Map.ScrollWheelZoom.js", "lib/leaflet-1.9.4/src/map/handler/Map.TapHold.js", "lib/leaflet-1.9.4/src/map/handler/Map.TouchZoom.js", "lib/leaflet-1.9.4/src/map/index.js"];
var BASE = self.registration.scope;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(new Request(new URL(u, BASE).href, { cache: 'reload' })).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('arb-') === 0 && k.indexOf('-tegels') < 0 && k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function bewaar(req, res) {
  if (res && res.ok) { var c = res.clone(); caches.open(V).then(function (ca) { ca.put(req, c); }); }
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) {                 // OSM-tegels: netwerk, anders eerder bewaarde tegel
    if (url.hostname === 'tile.openstreetmap.org') e.respondWith(fetch(req).then(function (r) { if (r.ok || r.type === 'opaque') { var c = r.clone(); caches.open('arb-tegels').then(function (ca) { ca.put(req, c); }); } return r; }).catch(function () { return caches.match(req); }));
    return;
  }
  var html = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (html || url.pathname.endsWith('.json')) {               // eerst netwerk (vers), anders bewaarde kopie
    var key = html ? new Request(url.origin + url.pathname) : req;
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(function (r) { return bewaar(key, r); }).catch(function () {
      return caches.match(key, { ignoreSearch: true }).then(function (m) {
        return m || (html ? caches.match(new URL('offline.html', BASE).href) : Response.error());
      });
    }));
    return;
  }
  e.respondWith(caches.match(req).then(function (m) {          // foto's, css, js, Leaflet: eerst bewaarde kopie
    return m || fetch(req).then(function (r) { return bewaar(req, r); });
  }));
});

// kaartpagina vraagt: bewaar pagina's + foto's van één tuin
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type !== 'bewaar-tuin' || !d.urls) return;
  var n = 0;
  e.waitUntil(caches.open(V).then(function (c) {
    return Promise.all(d.urls.map(function (u) {
      var abs = new URL(u, BASE).href;
      return c.match(abs).then(function (m) {
        if (m) { n++; return; }
        return fetch(abs).then(function (r) { if (r.ok) { n++; return c.put(abs, r); } }).catch(function () {});
      });
    }));
  }).then(function () {
    if (e.source) e.source.postMessage({ type: 'tuin-bewaard', tuin: d.tuin, n: n, totaal: d.urls.length });
  }));
});
