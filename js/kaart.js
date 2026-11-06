// Kaart van het Geografisch Arboretum Tervuren: GPS ("Waar ben ik?"), Dichtbij, zoeken,
// themawandelingen (?w=…) en zelf een wandeling opnemen.
(function () {
  'use strict';
  var ROOT = document.body.dataset.root || '../';
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var D = null, WAND = [], map, lagen = {}, sel, posDot, posCirkel, pos = null, watchId = null, eersteFix = true;
  var straal = 60, wand = null, opname = null, wakeLock = null, toonOpname = null;
  var R = 6371008.8, RAD = Math.PI / 180, EIKEN = 'https://eiken-plants4you.netlify.app/eiken/';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function naamHtml(n) {
    n = esc(n || '');
    if (/^onbekend$/.test(n)) return n;
    return '<i>' + n.replace(/(\s(?:subsp|var|f|cv)\.\s|\s[x×]\s|\s(?:species)$)/g, function (m) { return '</i>' + m + '<i>'; }) + '</i>';
  }
  function afstand(a, b) {
    var x = (b[1] - a[1]) * RAD * Math.cos((a[0] + b[0]) / 2 * RAD), y = (b[0] - a[0]) * RAD;
    return Math.sqrt(x * x + y * y) * R;
  }
  function richting(a, b) {
    var x = (b[1] - a[1]) * Math.cos(a[0] * RAD), y = b[0] - a[0];
    var g = (Math.atan2(x, y) / RAD + 360) % 360;
    return ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'][Math.round(g / 45) % 8];
  }
  function fmtM(m) { return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km'; }
  function melding(t) { var m = $('melding'); m.innerHTML = t || ''; m.hidden = !t; }
  function lees(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function schrijf(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function inRing(p, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var yi = ring[i][0], xi = ring[i][1], yj = ring[j][0], xj = ring[j][1];
      if (((yi > p[0]) !== (yj > p[0])) && (p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  // afstand tot een reeks (rechthoek rond het midden): 0 als je erin staat
  function afstandReeks(p, r) {
    var dy = Math.max(0, Math.abs(p[0] - r[2]) * RAD * R - r[5]);
    var dx = Math.max(0, Math.abs(p[1] - r[3]) * RAD * R * Math.cos(p[0] * RAD) - r[4]);
    return Math.sqrt(dx * dx + dy * dy);
  }
  function taxon(i) { var t = D.taxa[i]; return { slug: t[0], n: t[1], nl: t[2], naald: t[3], eik: t[4] || '' }; }
  function eikKnop(eik) { return eik ? '<a class="kn" href="' + EIKEN + eik + '/">Eikfiche</a>' : ''; }
  function fiche(slug) { return ROOT + 'soort/' + slug + '/'; }
  function groepNaam(c) { var g = D.groepen[c]; return g ? g.n : ''; }
  function hoofd(c) { var m = /^(\d+)/.exec(c || ''); return m ? +m[1] : null; }

  // ------------------------------------------------------------ kaart
  function kleur(naald) { return naald ? '#2e6b30' : '#c27a17'; }
  function start() {
    var canvas = L.canvas({ padding: 0.5, tolerance: 8 });
    map = L.map('map', { renderer: canvas, maxZoom: 20, zoomControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20, maxNativeZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · bomen: <a href="https://www.arboretum-tervuren.be">arboretum-tervuren.be</a>'
    }).addTo(map);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    map.fitBounds(D.bounds, { padding: [8, 8] });
    ['groepen', 'paden', 'reeksen', 'bomen', 'opname', 'wand', 'sel'].forEach(function (k) { lagen[k] = L.layerGroup().addTo(map); });
    tekenBasis();
    $('waar').addEventListener('click', wisselGps);
    document.querySelectorAll('.straal button').forEach(function (b) {
      b.addEventListener('click', function () {
        straal = +b.dataset.r;
        document.querySelectorAll('.straal button').forEach(function (x) { x.classList.toggle('aan', x === b); });
        dichtbij();
      });
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ll]');
      if (b) { var ll = b.dataset.ll.split(','); map.setView([+ll[0], +ll[1]], Math.max(map.getZoom(), 18)); $('map').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      var t = e.target.closest('[data-toon]');
      if (t) { e.preventDefault(); markeerTaxon(t.dataset.toon); }
    });
    zoekInit(); opnameInit();
    map.on('click', function (e) { if (!pos && $('handmatig').checked) nieuwePos({ coords: { latitude: e.latlng.lat, longitude: e.latlng.lng, accuracy: 5 } }, true); });
    var w = params.get('w'), t = params.get('t'), g = params.get('g'), ll = params.get('ll');
    if (w) startWandeling(w);
    if (t) markeerTaxon(t, ll);
    else if (ll) { var p = ll.split(','); map.setView([+p[0], +p[1]], 19); L.circleMarker([+p[0], +p[1]], { radius: 16, color: '#ffb300', weight: 5, fill: false }).addTo(lagen.sel); }
    if (g) markeerGroep(g);
    if (!('geolocation' in navigator) || window.self !== window.top) $('handmatigrij').hidden = false;
  }

  function popupStand(i, soort, x) {
    var t = taxon(x[0]);
    var h = '<b><a href="' + fiche(t.slug) + '">' + naamHtml(t.n) + '</a></b>' + (t.nl ? '<br>' + esc(t.nl) : '');
    h += '<br><span class="muted">' + (soort === 'reeks' ? 'reeks van ' + (x[6] || '?') + ' bomen' : 'afzonderlijke boom') +
      (x[1] ? ' · groep ' + esc(x[1]) + (groepNaam(x[1]) ? ' (' + esc(groepNaam(x[1])) + ')' : '') : '') +
      (x[soort === 'reeks' ? 8 : 5] ? ' · geplant ' + x[soort === 'reeks' ? 8 : 5] : '') +
      (x[soort === 'reeks' ? 7 : 4] ? ' · omtrek ' + x[soort === 'reeks' ? 7 : 4] + ' cm' : '') + '</span>';
    h += '<div class="pk"><a href="' + fiche(t.slug) + '">Plantenfiche</a> ' + (t.eik ? '<a href="' + EIKEN + t.eik + '/">Eikfiche</a> ' : '') + '<button class="sec" type="button" data-toon="' + t.slug + '">Alle exemplaren</button></div>';
    return h;
  }

  function tekenBasis() {
    Object.keys(D.groepen).forEach(function (c) {
      var g = D.groepen[c], h = hoofd(c), oud = h > 20;
      L.polygon(g.r, { color: oud ? '#8d6e63' : '#00796b', weight: 1, opacity: 0.5, fillColor: oud ? '#d7ccc8' : '#b2dfdb', fillOpacity: 0.18 })
        .bindPopup('<b>Groep ' + esc(c) + '</b><br>' + esc(g.n) + (h ? '<div class="pk"><a href="' + ROOT + 'groep/' + h + '/">Over groep ' + h + '</a></div>' : ''))
        .addTo(lagen.groepen);
    });
    D.paden.forEach(function (p) {
      L.polyline(p.p, { color: p.b ? '#9e8a6a' : '#7a5230', weight: p.b ? 2 : 3, opacity: 0.8, dashArray: p.b ? '4 4' : null, interactive: false }).addTo(lagen.paden);
    });
    D.reeksen.forEach(function (r, i) {
      var t = D.taxa[r[0]], dy = r[5] / (RAD * R), dx = r[4] / (RAD * R * Math.cos(r[2] * RAD));
      L.rectangle([[r[2] - dy, r[3] - dx], [r[2] + dy, r[3] + dx]], { stroke: false, fillColor: kleur(t[3]), fillOpacity: 0.4 })
        .bindPopup(function () { return popupStand(i, 'reeks', r); }).addTo(lagen.reeksen);
    });
    D.bomen.forEach(function (b, i) {
      var t = D.taxa[b[0]];
      L.circleMarker([b[2], b[3]], { radius: 5, color: '#fff', weight: 1.5, fillColor: kleur(t[3]), fillOpacity: 1 })
        .bindPopup(function () { return popupStand(i, 'boom', b); }).addTo(lagen.bomen);
    });
  }

  function markeerTaxon(slug, ll) {
    lagen.sel.clearLayers();
    var ti = -1;
    D.taxa.forEach(function (t, i) { if (t[0] === slug) ti = i; });
    if (ti < 0) { melding('Deze soort staat niet op de kaart.'); return; }
    var t = taxon(ti), pts = [], st = { radius: 13, color: '#ffb300', weight: 5, fill: false };
    D.bomen.forEach(function (b) { if (b[0] === ti) { pts.push([b[2], b[3]]); L.circleMarker([b[2], b[3]], st).bindPopup(popupStand(0, 'boom', b)).addTo(lagen.sel); } });
    D.reeksen.forEach(function (r) {
      if (r[0] !== ti) return;
      var dy = r[5] / (RAD * R), dx = r[4] / (RAD * R * Math.cos(r[2] * RAD));
      pts.push([r[2], r[3]]);
      L.rectangle([[r[2] - dy, r[3] - dx], [r[2] + dy, r[3] + dx]], { color: '#ffb300', weight: 4, fill: false }).bindPopup(popupStand(0, 'reeks', r)).addTo(lagen.sel);
    });
    if (ll) { var p = ll.split(','); map.setView([+p[0], +p[1]], 19); }
    else if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 19 });
    var u = new URL(location.href); u.searchParams.set('t', slug); history.replaceState(null, '', u);
    melding(naamHtml(t.n) + (t.nl ? ' (' + esc(t.nl) + ')' : '') + ': ' + pts.length + ' standplaats' + (pts.length === 1 ? '' : 'en') +
      ' oranje omrand. <a href="' + fiche(slug) + '">Plantenfiche</a> · <button type="button" class="link" id="wisSel">wis</button>');
    $('wisSel').onclick = function () { lagen.sel.clearLayers(); melding(''); var u2 = new URL(location.href); u2.searchParams.delete('t'); history.replaceState(null, '', u2); };
  }

  function markeerGroep(g) {
    var pts = [];
    Object.keys(D.groepen).forEach(function (c) {
      if (String(hoofd(c)) === String(g) || c === g) {
        D.groepen[c].r.forEach(function (ring) { pts = pts.concat(ring); });
        L.polygon(D.groepen[c].r, { color: '#ffb300', weight: 4, fill: false, interactive: false }).addTo(lagen.sel);
      }
    });
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.1));
  }

  // ------------------------------------------------------------ zoeken
  function zoekInit() {
    var inp = $('zoek'), uit = $('zoekres');
    inp.addEventListener('input', function () {
      var q = inp.value.trim().toLowerCase();
      if (q.length < 2) { uit.innerHTML = ''; uit.hidden = true; return; }
      var r = D.taxa.filter(function (t) { return t[1].toLowerCase().indexOf(q) >= 0 || (t[2] && t[2].toLowerCase().indexOf(q) >= 0); }).slice(0, 12);
      uit.innerHTML = r.length ? r.map(function (t) { return '<li><a href="#" data-toon="' + t[0] + '">' + naamHtml(t[1]) + (t[2] ? ' <span class="muted">' + esc(t[2]) + '</span>' : '') + '</a></li>'; }).join('') : '<li class="los">Niets gevonden.</li>';
      uit.hidden = false;
    });
    uit.addEventListener('click', function (e) { if (e.target.closest('[data-toon]')) { uit.hidden = true; inp.value = ''; } });
  }

  // ------------------------------------------------------------ GPS
  function wisselGps() {
    var b = $('waar');
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId); watchId = null; b.classList.remove('aan'); b.textContent = 'Waar ben ik?';
      $('dstat').textContent = '(GPS uit)'; return;
    }
    if (!navigator.geolocation) { melding('Dit toestel of deze browser geeft geen locatie. Vink <b>Tik zelf op de kaart</b> aan.'); $('handmatigrij').hidden = false; return; }
    b.classList.add('aan'); b.textContent = 'GPS zoekt…'; eersteFix = true;
    watchId = navigator.geolocation.watchPosition(function (p) { nieuwePos(p, false); }, function (err) {
      if (err.code === 1) {
        b.classList.remove('aan'); b.textContent = 'Waar ben ik?';
        if (watchId !== null) navigator.geolocation.clearWatch(watchId); watchId = null;
        melding('Locatie geweigerd of niet beschikbaar op deze pagina. Sta locatie toe in je browser, of vink <b>Tik zelf op de kaart</b> aan.');
        $('handmatigrij').hidden = false;
      } else $('dstat').textContent = '(GPS zoekt…)';
    }, { enableHighAccuracy: true, maximumAge: 4000, timeout: 30000 });
  }

  function nieuwePos(p, handmatig) {
    pos = { ll: [p.coords.latitude, p.coords.longitude], acc: p.coords.accuracy || 0, t: Date.now(), hand: !!handmatig };
    if (!handmatig) $('waar').textContent = '± ' + Math.round(pos.acc) + ' m';
    if (!posDot) {
      posCirkel = L.circle(pos.ll, { radius: pos.acc, color: '#1a73e8', weight: 1, fillColor: '#1a73e8', fillOpacity: 0.12, interactive: false }).addTo(map);
      posDot = L.circleMarker(pos.ll, { radius: 9, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1, interactive: false }).addTo(map);
    } else { posDot.setLatLng(pos.ll); posCirkel.setLatLng(pos.ll).setRadius(pos.acc); }
    posDot.bringToFront();
    if (eersteFix && !handmatig) {
      eersteFix = false;
      var b = L.latLngBounds(D.bounds).pad(0.2);
      if (b.contains(pos.ll)) map.setView(pos.ll, Math.max(map.getZoom(), 18));
      else { var c = L.latLngBounds(D.bounds).getCenter(); melding('Je bent ongeveer ' + fmtM(afstand(pos.ll, [c.lat, c.lng])) + ' van het arboretum.'); }
    }
    if (opname && !handmatig) opnamePunt();
    dichtbij(); wandelingVolg();
  }

  // ------------------------------------------------------------ Dichtbij: per soort de dichtste standplaats
  function wieDichtbij(p, max) {
    var best = {};
    function zet(ti, d, ll, sub) { if (d <= max && (!best[ti] || d < best[ti].d)) best[ti] = { ti: ti, d: d, ll: ll, sub: sub }; }
    D.bomen.forEach(function (b) { zet(b[0], afstand(p, [b[2], b[3]]), [b[2], b[3]], 'boom' + (b[4] ? ', omtrek ' + b[4] + ' cm' : '') + (b[5] ? ', ' + b[5] : '') + ' · ' + (b[1] || '')); });
    D.reeksen.forEach(function (r) { zet(r[0], afstandReeks(p, r), [r[2], r[3]], 'reeks van ' + (r[6] || '?') + (r[8] ? ', geplant ' + r[8] : '') + ' · ' + (r[1] || '')); });
    return Object.keys(best).map(function (k) { return best[k]; }).sort(function (a, b) { return a.d - b.d; });
  }
  function inGroep(p) {
    var c = Object.keys(D.groepen).filter(function (c) { return D.groepen[c].r.some(function (ring) { return inRing(p, ring); }); })[0];
    return c || null;
  }
  function dichtbij() {
    var el = $('dlijst');
    if (!pos) return;
    $('dstat').textContent = pos.hand ? '(gekozen punt)' : '(± ' + Math.round(pos.acc) + ' m, ' + new Date(pos.t).toLocaleTimeString('nl-BE') + ')';
    var c = inGroep(pos.ll), h = hoofd(c), kop = '';
    if (c) kop = '<p class="waar">Je staat in <b>groep ' + esc(c) + '</b>: ' + esc(groepNaam(c)) + (D.hoofd[h] ? ' · <a href="' + ROOT + 'groep/' + h + '/">' + esc(D.hoofd[h]) + '</a>' : '') + '</p>';
    var items = wieDichtbij(pos.ll, straal);
    if (!items.length) { el.innerHTML = kop + '<p class="muted">Geen bomen uit de collectie binnen ' + straal + ' m.</p>'; return; }
    el.innerHTML = kop + items.slice(0, 40).map(function (x) {
      var t = taxon(x.ti), ll = x.ll[0].toFixed(6) + ',' + x.ll[1].toFixed(6);
      return '<div class="d-item"><div class="d-afst">' + (x.d < 1 ? 'hier' : fmtM(x.d)) + (x.d >= 1 ? '<small>' + richting(pos.ll, x.ll) + '</small>' : '') + '</div><div>' +
        '<div class="d-naam"><a href="' + fiche(t.slug) + '">' + naamHtml(t.n) + '</a></div>' + (t.nl ? '<div class="d-sub">' + esc(t.nl) + '</div>' : '') +
        '<div class="d-sub">' + esc(x.sub) + '</div><div class="d-acties"><button type="button" data-ll="' + ll + '">Toon</button>' +
        '<a class="kn" href="' + fiche(t.slug) + '">Fiche</a>' + eikKnop(t.eik) + '</div></div></div>';
    }).join('') + (items.length > 40 ? '<p class="muted">… en nog ' + (items.length - 40) + ' soorten.</p>' : '');
  }

  // ------------------------------------------------------------ themawandeling
  function startWandeling(id) {
    wand = WAND.filter(function (w) { return w.id === id; })[0];
    if (!wand) return;
    var k = 'arb-wand-' + id;
    wand.gezien = lees(k, []);
    lagen.wand.clearLayers();
    L.polyline(wand.route, { color: wand.kleur, weight: 6, opacity: 0.75, interactive: false }).addTo(lagen.wand);
    wand.stops.forEach(function (s, i) {
      L.marker([s.lat, s.lon], { icon: L.divIcon({ className: 'stopnr', html: '<span style="background:' + wand.kleur + '">' + (i + 1) + '</span>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
        .bindPopup('<b>' + (i + 1) + '. ' + esc(s.titel) + '</b><br>' + naamHtml(s.n) + '<p>' + esc(s.tekst) + '</p><div class="pk"><a href="' + fiche(s.slug) + '?w=' + wand.id + '&s=' + i + '&van=kaart">Plantenfiche</a> ' + (s.eik ? '<a href="' + EIKEN + s.eik + '/">Eikfiche</a>' : '') + '</div>', { maxWidth: 300 })
        .addTo(lagen.wand);
    });
    L.marker([wand.start.lat, wand.start.lon], { icon: L.divIcon({ className: 'stopnr', html: '<span style="background:#0b4a45;border-radius:6px">S</span>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
      .bindPopup('<b>Start en einde</b><br>' + esc(wand.start.naam)).addTo(lagen.wand);
    map.fitBounds(L.latLngBounds(wand.route).pad(0.1));
    $('wandeling').hidden = false;
    $('woverzicht').href = ROOT + 'wandeling/?w=' + wand.id;
    $('wtitel').textContent = wand.titel;
    $('wmeta').textContent = 'Start en einde: ' + wand.start.naam + ' · ' + wand.stops.length + ' stops · ongeveer ' + fmtM(wand.lengte) + ' · ' + wand.seizoen;
    $('wvorige').onclick = function () { wand.manueel = Math.max(0, volgendeIndex() - 1); wand.gezien = wand.gezien.filter(function (i) { return i < wand.manueel; }); bewaarGezien(); wandelingVolg(); };
    $('wvolgende').onclick = function () { var i = volgendeIndex(); if (wand.gezien.indexOf(i) < 0) wand.gezien.push(i); bewaarGezien(); wandelingVolg(); };
    $('wreset').onclick = function () { wand.gezien = []; bewaarGezien(); wandelingVolg(); };
    wandelingVolg();
  }
  function bewaarGezien() { schrijf('arb-wand-' + wand.id, wand.gezien); }
  function volgendeIndex() { for (var i = 0; i < wand.stops.length; i++) if (wand.gezien.indexOf(i) < 0) return i; return wand.stops.length; }
  function wandelingVolg() {
    if (!wand) return;
    if (pos && !pos.hand) wand.stops.forEach(function (s, i) {
      if (wand.gezien.indexOf(i) < 0 && afstand(pos.ll, [s.lat, s.lon]) < Math.max(20, Math.min(pos.acc, 35))) { wand.gezien.push(i); bewaarGezien(); if (navigator.vibrate) navigator.vibrate([150, 80, 150]); }
    });
    var i = volgendeIndex(), el = $('wvolg');
    $('wlijst').innerHTML = wand.stops.map(function (s, k) {
      return '<li class="' + (wand.gezien.indexOf(k) >= 0 ? 'gezien' : '') + (k === i ? ' nu' : '') + '"><button type="button" data-ll="' + s.lat + ',' + s.lon + '">' + (k + 1) + '. ' + esc(s.titel) + '</button></li>';
    }).join('');
    if (i >= wand.stops.length) {
      var st = [wand.start.lat, wand.start.lon];
      el.innerHTML = '<p class="vstop"><b>Alle ' + wand.stops.length + ' stops bezocht.</b> Terug naar het vertrekpunt, ' + esc(wand.start.naam) + '<br>' +
        (pos ? '<span class="groot">' + fmtM(afstand(pos.ll, st)) + ' ' + richting(pos.ll, st) + '</span>' : '') + '</p><div class="d-acties"><button type="button" data-ll="' + st.join(',') + '">Toon vertrekpunt</button></div>';
      return;
    }
    var s = wand.stops[i];
    var afst = pos ? '<span class="groot">' + fmtM(afstand(pos.ll, [s.lat, s.lon])) + ' ' + richting(pos.ll, [s.lat, s.lon]) + '</span>' : '<span class="muted">Zet de GPS aan om de afstand te zien.</span>';
    el.innerHTML = '<p class="vstop">Stop ' + (i + 1) + ' van ' + wand.stops.length + ': <b>' + esc(s.titel) + '</b><br>' + afst + '</p>' +
      '<p>' + naamHtml(s.n) + (s.nl ? ' · ' + esc(s.nl) : '') + ' <span class="muted">(' + (s.soort === 'reeks' ? 'reeks' : 'boom') + ', groep ' + esc(s.g) + (s.j ? ', geplant ' + s.j : '') + (s.om ? ', omtrek ' + s.om + ' cm' : '') + ')</span></p>' +
      '<p class="tekst">' + esc(s.tekst) + '</p>' + (s.fotos && s.fotos.length ? '<div class="sfotos">' + s.fotos.map(function (f) { return '<figure><a href="' + ROOT + esc(f.src) + '" target="_blank"><img src="' + ROOT + esc(f.src) + '" alt="" loading="lazy"></a>' + (f.bijschrift ? '<figcaption>' + esc(f.bijschrift) + '</figcaption>' : '') + '</figure>'; }).join('') + '</div>' : '') +
      '<div class="d-acties"><button type="button" data-ll="' + s.lat + ',' + s.lon + '">Toon op kaart</button><a class="kn" href="' + fiche(s.slug) + '?w=' + wand.id + '&s=' + i + '&van=kaart">Plantenfiche</a>' + eikKnop(s.eik) + '</div>';
  }

  // ------------------------------------------------------------ zelf een wandeling opnemen
  var OPN = 'arb-opnames-v1';
  function opnames() { return lees(OPN, []); }
  function opnameInit() {
    $('opstart').onclick = function () {
      if (opname) { stopOpname(); return; }
      opname = { id: 'w' + Date.now(), naam: 'Wandeling ' + new Date().toLocaleString('nl-BE'), start: new Date().toISOString(), punten: [], stops: [] };
      var alle = opnames(); alle.push(opname); schrijf(OPN, alle);
      $('opstart').textContent = 'Stop opname'; $('opstart').classList.add('rood'); $('ophier').disabled = false;
      if (watchId === null) wisselGps();
      if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wakeLock = w; }).catch(function () {});
      $('opstat').textContent = 'Opname loopt. Laat het scherm aan en deze pagina open.';
      tekenOpname(opname);
    };
    $('ophier').onclick = function () {
      if (!opname) return;
      if (!pos) { $('opstat').textContent = 'Nog geen GPS-positie.'; return; }
      var bij = wieDichtbij(pos.ll, 25).slice(0, 5).map(function (x) { var t = taxon(x.ti); return { n: t.n, nl: t.nl, slug: t.slug, d: Math.round(x.d) }; });
      opname.stops.push({ lat: +pos.ll[0].toFixed(6), lon: +pos.ll[1].toFixed(6), acc: Math.round(pos.acc), t: new Date().toISOString(), notitie: $('opnotitie').value.trim(), groep: inGroep(pos.ll), bomen: bij });
      $('opnotitie').value = ''; bewaarOpname(); tekenOpname(opname);
      $('opstat').textContent = 'Stop ' + opname.stops.length + ' bewaard' + (bij.length ? ' (dichtbij: ' + bij.map(function (b) { return b.n; }).slice(0, 2).join(', ') + ')' : '') + '.';
    };
    $('oplijst').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-op]'); if (!b) return;
      var alle = opnames(), o = alle.filter(function (x) { return x.id === b.dataset.id; })[0]; if (!o) return;
      if (b.dataset.op === 'toon') { tekenOpname(o); if (o.punten.length) map.fitBounds(L.latLngBounds(o.punten.map(function (p) { return [p[0], p[1]]; })).pad(0.15)); }
      if (b.dataset.op === 'json') download(o.naam.replace(/[^\w-]+/g, '_') + '.json', JSON.stringify(o, null, 1), 'application/json');
      if (b.dataset.op === 'gpx') download(o.naam.replace(/[^\w-]+/g, '_') + '.gpx', gpx(o), 'application/gpx+xml');
      if (b.dataset.op === 'deel') deel(o);
      if (b.dataset.op === 'wis' && confirm('Deze opname verwijderen?')) { schrijf(OPN, alle.filter(function (x) { return x.id !== o.id; })); lagen.opname.clearLayers(); lijstOpnames(); }
    });
    lijstOpnames();
  }
  function opnamePunt() {
    var l = opname.punten[opname.punten.length - 1];
    if (pos.acc > 40) return;
    if (l && afstand([l[0], l[1]], pos.ll) < 5) return;
    opname.punten.push([+pos.ll[0].toFixed(6), +pos.ll[1].toFixed(6), Math.round((Date.now() - Date.parse(opname.start)) / 1000), Math.round(pos.acc)]);
    bewaarOpname(); tekenOpname(opname);
  }
  function bewaarOpname() {
    var alle = opnames().filter(function (x) { return x.id !== opname.id; }); alle.push(opname);
    if (!schrijf(OPN, alle)) $('opstat').textContent = 'Let op: bewaren op dit toestel lukt niet.';
  }
  function stopOpname() {
    opname.einde = new Date().toISOString(); bewaarOpname();
    $('opstat').textContent = 'Opname gestopt: ' + opname.punten.length + ' punten, ' + opname.stops.length + ' stops. Exporteer ze hieronder.';
    opname = null; $('opstart').textContent = 'Start opname'; $('opstart').classList.remove('rood'); $('ophier').disabled = true;
    if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; }
    lijstOpnames();
  }
  function lengteVan(o) { var s = 0; for (var i = 1; i < o.punten.length; i++) s += afstand(o.punten[i - 1], o.punten[i]); return s; }
  function tekenOpname(o) {
    lagen.opname.clearLayers();
    L.polyline(o.punten.map(function (p) { return [p[0], p[1]]; }), { color: '#d81b60', weight: 4, opacity: 0.85, interactive: false }).addTo(lagen.opname);
    o.stops.forEach(function (s, i) {
      L.marker([s.lat, s.lon], { icon: L.divIcon({ className: 'stopnr', html: '<span style="background:#d81b60">' + (i + 1) + '</span>', iconSize: [28, 28], iconAnchor: [14, 14] }) })
        .bindPopup('<b>Stop ' + (i + 1) + '</b>' + (s.notitie ? '<br>' + esc(s.notitie) : '') + (s.bomen.length ? '<ul class="d-eiken">' + s.bomen.map(function (b) { return '<li><a href="' + fiche(b.slug) + '">' + naamHtml(b.n) + '</a> <span class="muted">' + b.d + ' m</span></li>'; }).join('') + '</ul>' : ''))
        .addTo(lagen.opname);
    });
  }
  function lijstOpnames() {
    var alle = opnames();
    $('oplijst').innerHTML = alle.length ? alle.slice().reverse().map(function (o) {
      return '<li><b>' + esc(o.naam) + '</b><br><span class="muted">' + fmtM(lengteVan(o)) + ' · ' + o.stops.length + ' stops</span><div class="d-acties">' +
        ['toon:Toon', 'gpx:GPX', 'json:JSON', 'deel:Delen', 'wis:Verwijder'].map(function (x) { x = x.split(':'); return '<button type="button" data-op="' + x[0] + '" data-id="' + o.id + '">' + x[1] + '</button>'; }).join('') + '</div></li>';
    }).join('') : '<li class="los">Nog geen opnames op dit toestel.</li>';
  }
  function gpx(o) {
    var t0 = Date.parse(o.start);
    return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Arboretum Tervuren gids" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>' + esc(o.naam) + '</name></metadata>\n' +
      o.stops.map(function (s, i) { return '<wpt lat="' + s.lat + '" lon="' + s.lon + '"><time>' + s.t + '</time><name>Stop ' + (i + 1) + '</name><desc>' + esc((s.notitie || '') + (s.bomen.length ? ' | ' + s.bomen.map(function (b) { return b.n + ' (' + b.d + ' m)'; }).join(', ') : '')) + '</desc></wpt>'; }).join('\n') +
      '\n<trk><name>' + esc(o.naam) + '</name><trkseg>\n' + o.punten.map(function (p) { return '<trkpt lat="' + p[0] + '" lon="' + p[1] + '"><time>' + new Date(t0 + p[2] * 1000).toISOString() + '</time></trkpt>'; }).join('\n') + '\n</trkseg></trk>\n</gpx>\n';
  }
  function download(naam, tekst, type) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([tekst], { type: type })); a.download = naam;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function deel(o) {
    var f = new File([JSON.stringify(o)], o.naam.replace(/[^\w-]+/g, '_') + '.json', { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: o.naam }).catch(function () {});
    else download(f.name, JSON.stringify(o, null, 1), 'application/json');
  }

  // ------------------------------------------------------------ opstart
  Promise.all([fetch(ROOT + 'data/arboretum.json').then(function (r) { return r.json(); }), fetch(ROOT + 'data/wandelingen.json').then(function (r) { return r.json(); })])
    .then(function (x) {
      D = x[0]; WAND = x[1];
      if (window.L && L.map) start(); else window.addEventListener('leaflet-klaar', start, { once: true });
    }).catch(function () { melding('De kaartgegevens konden niet geladen worden.'); });
})();
