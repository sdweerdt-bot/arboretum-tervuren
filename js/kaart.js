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
    ['groepen', 'paden', 'reeksen', 'bomen', 'banken', 'opname', 'wand', 'sel'].forEach(function (k) { lagen[k] = L.layerGroup().addTo(map); });
    tekenBasis();
    $('waar').addEventListener('click', wisselGps);
    if ($('boomplusknop')) $('boomplusknop').addEventListener('click', boomPlus);
    draaiInit();
    if ($('padknop')) $('padknop').addEventListener('click', padStart);
    var bezig = lees('arb-pad-bezig', null); if (bezig && bezig.pts) { PAD = bezig; if (PAD.pts.length) padLijn = L.polyline(PAD.pts, { color: '#e65100', weight: 5, dashArray: '8 6' }).addTo(map); toonPadPaneel(); melding('Je was een pad aan het opnemen: de opname loopt verder. Zet de GPS aan.'); }
    window.addEventListener('online', synchroniseer); setTimeout(synchroniseer, 1500);
    if ($('bankplusknop')) $('bankplusknop').addEventListener('click', bankPlus);
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
      var k = e.target.closest('[data-kal]');
      if (k) { var q = k.dataset.kal.split(','); map.closePopup(); kalibreer(+q[0], +q[1], k.dataset.kalnaam || 'deze plek'); }
      var pw = e.target.closest('[data-padweg]');
      if (pw) { var c = map.closePopup() && null; var ll2 = (pw.dataset.padweg || '').split(','); var x = { lat: +ll2[0], lon: +ll2[1], datum: new Date().toISOString().slice(0, 10) };
        if (pos && !pos.hand && afstand(pos.ll, [x.lat, x.lon]) < 60 && confirm('Gebruik je huidige plaats als plek waar het pad niet bestaat? (Annuleren = midden van het getekende pad)')) { x.lat = +pos.ll[0].toFixed(6); x.lon = +pos.ll[1].toFixed(6); }
        var q2 = lees('arb-padwegwachtrij', []); q2.push(x); schrijf('arb-padwegwachtrij', q2); L.circleMarker([x.lat, x.lon], { radius: 8, color: '#c62828', weight: 3, fill: false }).addTo(lagen.paden);
        melding('Gemeld: hier bestaat het pad niet. Ik haal het weg bij de volgende verwerking.'); synchroniseer(); }
      if (e.target.closest('[data-kalweg]')) { KAL = null; if (pos && pos.ruw) nieuwePos({ coords: { latitude: pos.ruw[0], longitude: pos.ruw[1], accuracy: pos.acc } }, false); melding('Bijstelling ongedaan gemaakt.'); }
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
    h += '<div class="pk"><a href="' + fiche(t.slug) + '">Plantenfiche</a> ' + (t.eik ? '<a href="' + EIKEN + t.eik + '/">Eikfiche</a> ' : '') + '<button class="sec" type="button" data-toon="' + t.slug + '">Alle exemplaren</button>' +
      (soort === 'boom' && pos && !pos.hand ? '<button class="sec" type="button" data-kal="' + x[2] + ',' + x[3] + '" data-kalnaam="' + esc(t.nl || t.n) + '">📍 Ik sta bij deze boom</button>' : '') + '</div>';
    return h;
  }

  function tekenBasis() {
    Object.keys(D.groepen).forEach(function (c) {
      var g = D.groepen[c], h = hoofd(c), oud = h > 20;
      L.polygon(g.r, { color: oud ? '#8d6e63' : '#00796b', weight: 1, opacity: 0.5, fillColor: oud ? '#d7ccc8' : '#b2dfdb', fillOpacity: 0.18 })
        .bindPopup('<b>Groep ' + esc(c) + '</b><br>' + esc(g.n) + (h ? '<div class="pk"><a href="' + ROOT + 'groep/' + h + '/">Over groep ' + h + '</a></div>' : ''))
        .addTo(lagen.groepen);
    });
    // nummers van de 40 zones, met de geografische streek
    var per = {};
    Object.keys(D.groepen).forEach(function (c) { var h = hoofd(c); if (!h) return; D.groepen[c].r.forEach(function (r) {
      var a = 0, cx = 0, cy = 0; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { var f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f; }
      if (a && (!per[h] || Math.abs(a) > per[h].a)) per[h] = { a: Math.abs(a), p: [cx / (3 * a), cy / (3 * a)] }; }); });
    Object.keys(per).forEach(function (h) {
      var t = (D.hoofd && D.hoofd[h]) || '';
      L.marker(per[h].p, { icon: L.divIcon({ className: 'zonenr' + (+h > 20 ? ' oud' : ''), html: h }), keyboard: false })
        .bindTooltip('<b>Zone ' + h + '</b><br>' + esc(t), { direction: 'top' })
        .bindPopup((window.ZIMG && ZIMG[h] ? '<img src="' + ROOT + 'img/' + ZIMG[h] + '" alt="" style="width:220px;height:100px;object-fit:cover;border-radius:6px"><br>' : '') + '<span class="muted">Zone ' + h + ' · ' + (+h > 20 ? 'Oude Wereld' : 'Nieuwe Wereld') + '</span><br><b>' + esc(t) + '</b><div class="pk"><a href="' + ROOT + 'groep/' + h + '/">Over deze zone</a></div>')
        .addTo(lagen.zones || (lagen.zones = L.layerGroup()));
    });
    function zonesZicht() { if (map.getZoom() >= 17) { if (!map.hasLayer(lagen.zones)) lagen.zones.addTo(map); } else if (map.hasLayer(lagen.zones)) map.removeLayer(lagen.zones); }
    map.on('zoomend', zonesZicht); zonesZicht();
    (D.gras || []).forEach(function (g) {
      L.polygon(g.p, { color: '#9cc46a', weight: 1, fillColor: '#cfe8a9', fillOpacity: 0.75 }).bindPopup('<b>' + esc(g.n || 'Grasveld') + '</b><br>Grasveld of weide: hier mag je vrij wandelen.').addTo(lagen.groepen);
    });
    L.marker([50.81106, 4.50663], { icon: L.divIcon({ className: 'parkingP', html: 'P', iconSize: [24, 24], iconAnchor: [12, 12] }) }).bindPopup('<b>Parking Eikestraat</b><br>De wandelingen starten en eindigen enkele meters verder, aan de slagboom bij het begin van de beukendreef.').addTo(lagen.groepen);
    D.paden.forEach(function (p) {
      if (p.b) { L.polyline(p.p, { color: '#a89f8c', weight: 8, opacity: 0.9, interactive: false }).addTo(lagen.paden); L.polyline(p.p, { color: '#ffffff', weight: 5, opacity: 1 }).bindPopup(padPopup).addTo(lagen.paden); }
      else L.polyline(p.p, { color: p.e ? '#e65100' : '#6b4423', weight: p.e ? 3.5 : 2.5, opacity: 0.95 }).bindPopup(padPopup).addTo(lagen.paden);
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
    if ($('wspraak') && $('wspraak').checked && window.speechSynthesis && wand) { var u0 = new SpeechSynthesisUtterance('GPS staat aan'); u0.lang = 'nl-BE'; speechSynthesis.speak(u0); }   // een eerste zin bij een tik zet het geluid vrij op gsm
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
    var ruw = [p.coords.latitude, p.coords.longitude];
    if (KAL && !handmatig && (Date.now() - KAL.t > 20 * 60000 || afstand(ruw, KAL.ruw) > 400)) { KAL = null; melding('De bijstelling van de GPS is gestopt (20 minuten of 400 m verder). Sta je weer bij een stop of boom, dan kan je opnieuw bijstellen.'); }
    var ll = KAL && !handmatig ? [ruw[0] + KAL.dlat, ruw[1] + KAL.dlon] : ruw;
    pos = { ll: ll, ruw: ruw, acc: p.coords.accuracy || 0, t: Date.now(), hand: !!handmatig };
    if (!handmatig) $('waar').textContent = '± ' + Math.round(pos.acc) + ' m' + (KAL ? ' · bijgesteld' : '');
    if (!handmatig) volgRichting(p);
    if (!posDot) {
      posCirkel = L.circle(pos.ll, { radius: pos.acc, color: '#1a73e8', weight: 1, fillColor: '#1a73e8', fillOpacity: 0.12, interactive: false }).addTo(map);
      posDot = L.marker(pos.ll, { icon: L.divIcon({ className: 'posicoon', html: '<div class="pospijl" id="pospijl"><svg viewBox="0 0 40 40" width="40" height="40"><path class="pijlkop" d="M20 2 L29 22 L20 17 L11 22 Z" fill="#1a73e8" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="20" cy="22" r="8" fill="#1a73e8" stroke="#fff" stroke-width="3"/></svg></div>', iconSize: [40, 40], iconAnchor: [20, 22] }), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map);
    } else { posDot.setLatLng(pos.ll); posCirkel.setLatLng(pos.ll).setRadius(pos.acc); }
    toonRichting();
    if (draai.aan) map.setView(pos.ll, map.getZoom(), { animate: false });
    if (eersteFix && !handmatig) {
      eersteFix = false;
      var b = L.latLngBounds(D.bounds).pad(0.2);
      if (b.contains(pos.ll)) map.setView(pos.ll, Math.max(map.getZoom(), 18));
      else { var c = L.latLngBounds(D.bounds).getCenter(); melding('Je bent ongeveer ' + fmtM(afstand(pos.ll, [c.lat, c.lng])) + ' van het arboretum.'); }
    }
    if (opname && !handmatig) opnamePunt();
    if (PAD && !handmatig) padPunt();
    dichtbij(); wandelingVolg(); navigatie();
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
    L.polyline(wand.route, { color: wand.kleur, weight: 7, opacity: 0.8, interactive: false }).addTo(lagen.wand);
    wand.stops.forEach(function (s, i) {
      L.marker([s.lat, s.lon], { icon: L.divIcon({ className: 'stopnr', html: '<span style="background:' + wand.kleur + '">' + (i + 1) + '</span>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
        .bindPopup('<b>' + (i + 1) + '. ' + esc(s.titel) + '</b><br>' + naamHtml(s.n) + '<p>' + esc(s.tekst) + '</p><div class="pk">' + (s.slug ? '<a href="' + fiche(s.slug) + '?w=' + wand.id + '&s=' + i + '&van=kaart">Plantenfiche</a> ' : '') + (s.eik ? '<a href="' + EIKEN + s.eik + '/">Eikfiche</a>' : '') + '</div>', { maxWidth: 300 })
        .addTo(lagen.wand);
    });
    L.marker([wand.start.lat, wand.start.lon], { icon: L.divIcon({ className: 'stopnr', html: '<span style="background:#0b4a45;border-radius:6px">S</span>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
      .bindPopup('<b>Start en einde</b><br>' + esc(wand.start.naam)).addTo(lagen.wand);
    map.fitBounds(L.latLngBounds(wand.route).pad(0.1));
    $('wandeling').hidden = false;
    $('woverzicht').href = ROOT + 'wandeling/?w=' + wand.id;
    $('wtitel').textContent = wand.titel;
    $('wmeta').textContent = 'Start en einde: ' + wand.start.naam + ' · ' + wand.stops.length + ' stops · ongeveer ' + fmtM(wand.lengte) + ' · ' + wand.seizoen;
    wand.toon = null; wand.bij = null; wand.vast = null;
    var sp = $('wspraak');
    if (sp && !sp.dataset.klaar) {
      sp.dataset.klaar = 1; sp.checked = lees('arb-spraak', false);
      sp.onchange = function () { schrijf('arb-spraak', sp.checked); if (sp.checked && window.speechSynthesis) { var u = new SpeechSynthesisUtterance('Gesproken aanwijzingen staan aan'); u.lang = 'nl-BE'; speechSynthesis.cancel(); speechSynthesis.speak(u); } };
    }
    $('wvorige').onclick = function () { var i = huidigeStop(); wand.toon = Math.max(0, i - 1); wand.vast = pos ? pos.ll : [0, 0]; wandelingVolg(); };
    $('wvolgende').onclick = function () { var i = huidigeStop(); if (wand.gezien.indexOf(i) < 0 && i < wand.stops.length) { wand.gezien.push(i); bewaarGezien(); } wand.toon = Math.min(wand.stops.length, i + 1); wand.vast = pos ? pos.ll : [0, 0]; wandelingVolg(); };
    $('wreset').onclick = function () { wand.gezien = []; wand.toon = null; wand.bij = null; wand.vast = null; bewaarGezien(); wandelingVolg(); };
    if ($('wfoto')) $('wfoto').onchange = function () { var fi = this; if (!fi.files || !fi.files[0]) return; var f = fi.files[0], k = +fi.dataset.stop; fi.value = ''; wand.toon = k; wand.vast = pos ? pos.ll : [0, 0]; window.ARB_FOTO_VERWERK(wand, k, f, $('wfotostatus')); };
    $('wlijst').onclick = function (e) { var b = e.target.closest('[data-stop]'); if (!b) return; wand.toon = +b.dataset.stop; wand.vast = pos ? pos.ll : [0, 0]; wandelingVolg(); };
    wandelingVolg();
  }
  function bewaarGezien() { schrijf('arb-wand-' + wand.id, wand.gezien); }
  // ------------------------------------------------------------ richtingaanwijzingen bij kruispunten
  var AFSLAG = { r: ['⬆', 'ga rechtdoor bij het kruispunt'], l: ['⬅', 'sla linksaf'], rr: ['➡', 'sla rechtsaf'], L: ['↙', 'sla scherp linksaf'], R: ['↘', 'sla scherp rechtsaf'], o: ['↩', 'keer om en ga terug langs hetzelfde pad'],
    bl: ['↰', 'volg het pad naar links'], br: ['↱', 'volg het pad naar rechts'] };
  function navVoorbereid() {
    if (wand.cum) return; wand.cum = [0];
    for (var i = 1; i < wand.route.length; i++) wand.cum.push(wand.cum[i - 1] + afstand(wand.route[i - 1], wand.route[i]));
    wand.ri = 0; wand.s = null; wand.gemeld = {};
  }
  // Positie langs de route: loodrechte projectie op het dichtstbijzijnde routestuk (niet het dichtste hoekpunt),
  // met voorkeur voor het stuk dat aansluit bij de vorige positie (belangrijk waar de route twee keer langs dezelfde plek loopt).
  function opRoute(ll) {
    var r = wand.route, best = null, cosl = Math.cos(ll[0] * RAD);
    function proj(i) {
      var a = r[i], b = r[i + 1];
      var ax = (a[1] - ll[1]) * cosl, ay = a[0] - ll[0], bx = (b[1] - ll[1]) * cosl, by = b[0] - ll[0];
      var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      var px = ax + t * dx, py = ay + t * dy, d = Math.sqrt(px * px + py * py) * RAD * R;
      return { i: i, d: d, s: wand.cum[i] + t * (wand.cum[i + 1] - wand.cum[i]) };
    }
    function zoek(van, tot) {
      for (var i = van; i < tot; i++) {
        var p = proj(i), straf = 0;
        if (wand.s !== null) { var ds = p.s - wand.s; straf = ds < -25 ? 25 : (ds > 400 ? 15 : 0); }   // achteruit of ver vooruit springen kost extra
        p.sc = p.d + straf;
        if (!best || p.sc < best.sc) best = p;
      }
    }
    zoek(Math.max(0, wand.ri - 40), Math.min(r.length - 1, wand.ri + 300));
    if (!best || best.d > 40) { best = null; zoek(0, r.length - 1); }
    return best;
  }
  function navigatie() {
    var el = $('wnav'); if (!el) return;
    if (!wand || !pos || pos.hand || !wand.afslagen || !wand.afslagen.length) { el.hidden = true; return; }
    navVoorbereid();
    var p = opRoute(pos.ll);
    if (!p || p.d > 40) { el.hidden = false; el.className = 'wnav weg'; el.innerHTML = '<span class="pijl">⚠</span><span>Je bent ' + fmtM(p ? p.d : 999) + ' van de route. Ga terug naar de gekleurde lijn.</span>'; return; }
    wand.ri = p.i; wand.s = p.s;
    // volgende aanwijzing: de eerste die niet meer dan 8 m achter ons ligt (sta je op het kruispunt zelf, dan blijft ze staan)
    var a = null, i;
    for (i = 0; i < wand.afslagen.length; i++) { var sa = wand.cum[wand.afslagen[i][3]]; if (sa >= p.s - 8) { a = wand.afslagen[i]; break; } }
    if (!a) { el.hidden = true; return; }
    var rest = Math.max(0, wand.cum[a[3]] - p.s);
    if (rest > 70) {
      el.hidden = false; el.className = 'wnav ver'; el.innerHTML = '<span class="pijl">⬆</span><span>Volg het pad nog ' + fmtM(Math.round(rest / 10) * 10) + '</span>';
      // uitspreken: één keer per stuk pad, als de volgende aanwijzing verandert (na een kruispunt of bij de start)
      if (!wand.gemeld['v' + a[3]]) { wand.gemeld['v' + a[3]] = 1; zeg('Volg het pad nog ' + (Math.round(rest / 10) * 10) + ' meter'); }
      return;
    }
    var t = AFSLAG[a[2]] || AFSLAG.r, m = Math.max(5, Math.round(rest / 5) * 5);
    el.hidden = false; el.className = 'wnav' + (rest <= 25 ? ' nu' : '');
    el.innerHTML = '<span class="pijl">' + t[0] + '</span><span>' + (rest <= 8 ? 'Nu: ' : 'Over ' + m + ' m: ') + '<b>' + t[1] + '</b></span>';
    var sl = a[3];
    wand.gemeld['v' + sl] = 1;
    if (rest > 25 && !wand.gemeld['70-' + sl]) { wand.gemeld['70-' + sl] = 1; zeg('Over ' + m + ' meter ' + t[1]); }
    if (rest <= 25 && !wand.gemeld[sl]) {
      wand.gemeld[sl] = 1; wand.gemeld['70-' + sl] = 1;
      if (navigator.vibrate) navigator.vibrate(a[2] === 'r' ? 80 : [120, 60, 120]);
      zeg((rest <= 8 ? 'Nu ' : 'Over ' + m + ' meter ') + t[1]);
    }
  }
  function volgendeIndex() { for (var i = 0; i < wand.stops.length; i++) if (wand.gezien.indexOf(i) < 0) return i; return wand.stops.length; }
  // welke stop tonen: een manueel gekozen stop (vorige/volgende/lijst) blijft staan tot je 60 m verder bent;
  // kom je bij een stop aan, dan blijft die in beeld zolang je er binnen 45 m van bent; daarna de eerstvolgende niet bezochte stop.
  function huidigeStop() { return wand.toon !== null && wand.toon !== undefined ? wand.toon : (wand.bij !== null && wand.bij !== undefined ? wand.bij : volgendeIndex()); }
  function zeg(t) {
    if (!($('wspraak') && $('wspraak').checked && window.speechSynthesis)) return;
    var u = new SpeechSynthesisUtterance(t); u.lang = 'nl-BE';
    if (!(speechSynthesis.speaking && Date.now() - leestSinds < 90000)) speechSynthesis.cancel();   // stopinfo niet onderbreken, aanwijzing komt erna
    speechSynthesis.speak(u);
  }
  var leestSinds = 0;
  // langere tekst voorlezen: per zin, want sommige gsm's breken lange zinnen af
  function leesVoor(t, altijd) {
    if (!window.speechSynthesis || (!altijd && !($('wspraak') && $('wspraak').checked))) return;
    speechSynthesis.cancel(); leestSinds = Date.now();
    String(t || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).forEach(function (z) {
      z = z.trim(); if (!z) return;
      var u = new SpeechSynthesisUtterance(z); u.lang = 'nl-BE'; speechSynthesis.speak(u);
    });
  }
  function stopTekstKort(s, i) { return 'Je bent bij stop ' + (i + 1) + ': ' + s.titel + '. ' + (s.tekst || ''); }
  function stopTekstLang(s, i) {
    return 'Stop ' + (i + 1) + ': ' + s.titel + '. ' + (s.nl ? s.nl + '. ' : '') + (s.tekst || '') + ' ' + (s.verhaal || '') + ' ' + (s.kijk ? 'Kijk: ' + s.kijk : '') + ' ' + (s.weetje ? 'Weetje: ' + s.weetje : '');
  }
  function wandelingVolg() {
    if (!wand) return;
    if (pos && !pos.hand) {
      var straal = Math.max(20, Math.min(pos.acc, 35));
      if (wand.vast && afstand(pos.ll, wand.vast) > 60) { wand.vast = null; wand.toon = null; }
      wand.stops.forEach(function (s, i) {
        if (wand.gezien.indexOf(i) < 0 && afstand(pos.ll, [s.lat, s.lon]) < straal) {
          wand.gezien.push(i); bewaarGezien(); wand.bij = i;
          if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
          if (!wand.vast) leesVoor(stopTekstKort(s, i));
        }
      });
      if (wand.bij !== null && wand.bij !== undefined && afstand(pos.ll, [wand.stops[wand.bij].lat, wand.stops[wand.bij].lon]) > 45) wand.bij = null;
    }
    var i = huidigeStop(), el = $('wvolg');
    $('wlijst').innerHTML = wand.stops.map(function (s, k) {
      return '<li class="' + (wand.gezien.indexOf(k) >= 0 ? 'gezien' : '') + (k === i ? ' nu' : '') + '"><button type="button" data-stop="' + k + '">' + (k + 1) + '. ' + esc(s.titel) + '</button></li>';
    }).join('');
    if (i >= wand.stops.length) {
      if ($('wfotoblok')) $('wfotoblok').hidden = true;
      var st = [wand.start.lat, wand.start.lon];
      el.innerHTML = '<p class="vstop"><b>Alle ' + wand.stops.length + ' stops bezocht.</b> Terug naar het vertrekpunt, ' + esc(wand.start.naam) + '<br>' +
        (pos ? '<span class="groot">' + fmtM(afstand(pos.ll, st)) + ' ' + richting(pos.ll, st) + '</span>' : '') + '</p><div class="d-acties"><button type="button" data-ll="' + st.join(',') + '">Toon vertrekpunt</button></div>';
      return;
    }
    var s = wand.stops[i];
    var afst = pos ? '<span class="groot">' + fmtM(afstand(pos.ll, [s.lat, s.lon])) + ' ' + richting(pos.ll, [s.lat, s.lon]) + '</span>' : '<span class="muted">Zet de GPS aan om de afstand te zien.</span>';
    el.innerHTML = (s.hoofdstuk ? '<p class="hfst" style="--kl:' + wand.kleur + '">' + esc(s.hoofdstuk) + '</p>' : '') + '<p class="vstop">' + (i === wand.bij ? '📍 Je bent bij stop ' : 'Stop ') + (i + 1) + ' van ' + wand.stops.length + ': <b>' + esc(s.titel) + '</b><br>' + (i === wand.bij ? '' : afst) + '</p>' +
      (s.n ? '<p>' + naamHtml(s.n) + (s.nl ? ' · ' + esc(s.nl) : '') + ' <span class="muted">(' + (s.soort === 'reeks' ? 'reeks' : 'boom') + ', groep ' + esc(s.g) + (s.j ? ', geplant ' + s.j : '') + (s.om ? ', omtrek ' + s.om + ' cm' : '') + ')</span></p>' : '<p class="muted">' + esc(s.plaats || '') + '</p>') +
      '<p class="tekst">' + esc(s.tekst) + '</p>' + (s.fotos && s.fotos.length ? '<div class="sfotos">' + s.fotos.map(function (f) { return '<figure><a href="' + ROOT + esc(f.src) + '" target="_blank"><img src="' + ROOT + esc(f.src) + '" alt="" loading="lazy"></a>' + (f.bijschrift ? '<figcaption>' + esc(f.bijschrift) + '</figcaption>' : '') + '</figure>'; }).join('') + '</div>' : '') +
      (s.weetje ? '<div class="gb weetje"><b>Weetje</b><p>' + esc(s.weetje) + '</p></div>' : '') +
      '<div class="d-acties">' + (pos && !pos.hand ? '<button type="button" data-kal="' + s.lat + ',' + s.lon + '" data-kalnaam="stop ' + (i + 1) + '" title="Klopt de blauwe bol niet met de kaart? Tik hier als je bij deze stop staat.">📍 Ik sta bij deze stop</button>' : '') + (window.speechSynthesis ? '<button type="button" id="wvoorlees">' + (speechSynthesis.speaking ? '⏹ Stop voorlezen' : '🔊 Voorlezen') + '</button>' : '') + (s.verhaal ? '<a class="kn" href="' + ROOT + 'wandeling/?w=' + wand.id + '#stop-' + (i + 1) + '">Gidstekst</a>' : '') + '<button type="button" data-ll="' + s.lat + ',' + s.lon + '">Toon op kaart</button>' + (s.slug ? '<a class="kn" href="' + fiche(s.slug) + '?w=' + wand.id + '&s=' + i + '&van=kaart">Plantenfiche</a>' : '') + eikKnop(s.eik) + '</div>';
    if ($('wvoorlees')) $('wvoorlees').onclick = function () {
      if (speechSynthesis.speaking) { speechSynthesis.cancel(); leestSinds = 0; this.textContent = '🔊 Voorlezen'; return; }
      leesVoor(stopTekstLang(s, i), true); this.textContent = '⏹ Stop voorlezen';
    };
    var fb = $('wfotoblok');
    if (fb && window.ARB_FOTO_VERWERK) { fb.hidden = false; if ($('wfoto').dataset.stop !== String(i)) { $('wfoto').dataset.stop = i; $('wfotostatus').innerHTML = ''; } $('wfotolabel').textContent = '📷 Foto nemen of kiezen bij stop ' + (i + 1); }
  }

  // ------------------------------------------------------------ zelf een wandeling opnemen
  var OPN = 'arb-opnames-v1';
  function opnames() { return lees(OPN, []); }
  function opnameInit() {
    $('opgeluid').onchange = function () { $('opgeluidopties').hidden = !this.checked; };
    if (/[?&]opnemen=1/.test(location.search)) { $('opgeluid').checked = true; $('opgeluidopties').hidden = false; setTimeout(function () { $('opnemen').scrollIntoView({ behavior: 'smooth' }); }, 600); }
    $('opstart').onclick = function () {
      if (opname) { stopOpname(); return; }
      if ($('opgeluid').checked) {
        if (!$('optoest').checked) { $('opstat').textContent = 'Vink eerst aan dat de gids toestemming gaf voor de geluidsopname.'; return; }
        if (!navigator.mediaDevices || !window.MediaRecorder) { $('opstat').textContent = 'Geluid opnemen kan niet in deze browser. Neem op zonder geluid of gebruik Chrome.'; return; }
        $('opstart').disabled = true; $('opstat').textContent = 'Microfoon wordt gevraagd…';
        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (st) {
          $('opstart').disabled = false; startOpname(st);
        }).catch(function () { $('opstart').disabled = false; $('opstat').textContent = 'Geen toegang tot de microfoon. Sta de microfoon toe of neem op zonder geluid.'; });
        return;
      }
      startOpname(null);
    };
    function startOpname(stream) {
      var gids = $('opgids').value.trim();
      opname = { id: 'w' + Date.now(), naam: (gids ? 'Gidstocht ' + gids + ' ' : 'Wandeling ') + new Date().toLocaleString('nl-BE'), start: new Date().toISOString(), punten: [], stops: [] };
      if (stream) { opname.audio = { gids: gids, toestemming: new Date().toISOString(), stukken: 0 }; opname.uitschrift = []; startGeluid(stream); if ($('optekst').checked) startUitschrift(); }
      var alle = opnames(); alle.push(opname); schrijf(OPN, alle);
      $('opstart').textContent = 'Stop opname'; $('opstart').classList.add('rood'); $('ophier').disabled = false;
      if (watchId === null) wisselGps();
      if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wakeLock = w; }).catch(function () {});
      $('opstat').textContent = 'Opname loopt' + (opname.audio ? ' (met geluid)' : '') + '. Laat het scherm aan en deze pagina open.';
      tekenOpname(opname);
    }
    $('ophier').onclick = function () {
      if (!opname) return;
      if (!pos) { $('opstat').textContent = 'Nog geen GPS-positie.'; return; }
      var bij = wieDichtbij(pos.ll, 25).slice(0, 5).map(function (x) { var t = taxon(x.ti); return { n: t.n, nl: t.nl, slug: t.slug, d: Math.round(x.d) }; });
      opname.stops.push({ lat: +pos.ll[0].toFixed(6), lon: +pos.ll[1].toFixed(6), acc: Math.round(pos.acc), t: new Date().toISOString(), sec: Math.round((Date.now() - Date.parse(opname.start)) / 1000), notitie: $('opnotitie').value.trim(), groep: inGroep(pos.ll), bomen: bij });
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
      if (b.dataset.op === 'pak') pakket(o, b);
      if (b.dataset.op === 'wis' && confirm('Deze opname verwijderen?')) { wisGeluid(o.id); schrijf(OPN, alle.filter(function (x) { return x.id !== o.id; })); lagen.opname.clearLayers(); lijstOpnames(); }
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
    opname.einde = new Date().toISOString(); stopGeluid(); bewaarOpname();
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
      return '<li><b>' + esc(o.naam) + '</b><br><span class="muted">' + fmtM(lengteVan(o)) + ' · ' + o.stops.length + ' stops' + (o.audio ? ' · met geluid' + (o.uitschrift && o.uitschrift.length ? ' en uitschrift' : '') : '') + '</span><div class="d-acties">' +
        (o.audio ? ['pak:Pakket (zip)', 'toon:Toon', 'wis:Verwijder'] : ['toon:Toon', 'gpx:GPX', 'json:JSON', 'deel:Delen', 'wis:Verwijder']).map(function (x) { x = x.split(':'); return '<button type="button" data-op="' + x[0] + '" data-id="' + o.id + '">' + x[1] + '</button>'; }).join('') + '</div></li>';
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

  // ------------------------------------------------------------ geluid, uitschrift en pakket (gidstocht opnemen)
  var rec = null, recStream = null, herk = null;
  function idb() {
    return new Promise(function (ok, nok) {
      var r = indexedDB.open('arb-geluid', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('stukken'); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { nok(r.error); };
    });
  }
  function idbZet(k, v) { return idb().then(function (db) { return new Promise(function (ok, nok) { var t = db.transaction('stukken', 'readwrite'); t.objectStore('stukken').put(v, k); t.oncomplete = ok; t.onerror = function () { nok(t.error); }; }); }); }
  function idbStukken(id) {
    return idb().then(function (db) { return new Promise(function (ok, nok) {
      var uit = [], t = db.transaction('stukken'), q = t.objectStore('stukken').openCursor(IDBKeyRange.bound(id + '-', id + '-~'));
      q.onsuccess = function () { var c = q.result; if (c) { uit.push(c.value); c.continue(); } else ok(uit); }; q.onerror = function () { nok(q.error); };
    }); });
  }
  function wisGeluid(id) { idb().then(function (db) { db.transaction('stukken', 'readwrite').objectStore('stukken').delete(IDBKeyRange.bound(id + '-', id + '-~')); }).catch(function () {}); }
  function startGeluid(stream) {
    recStream = stream;
    var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'], mime = '';
    for (var i = 0; i < types.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) { mime = types[i]; break; }
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
    var o = opname; o.audio.mime = rec.mimeType || mime || 'audio/webm';
    rec.ondataavailable = function (e) {
      if (!e.data || !e.data.size) return;
      var n = o.audio.stukken++; bewaarVan(o);
      idbZet(o.id + '-' + ('00000' + n).slice(-5), e.data).catch(function () { $('opstat').textContent = 'Let op: het geluid kon niet bewaard worden op dit toestel.'; });
    };
    rec.start(10000);
  }
  function bewaarVan(o) { var alle = opnames().filter(function (x) { return x.id !== o.id; }); alle.push(o); schrijf(OPN, alle); }
  function stopGeluid() {
    if (herk) { var h = herk; herk = null; try { h.stop(); } catch (e) {} }
    if (rec && rec.state !== 'inactive') { var st = recStream; rec.onstop = function () { st.getTracks().forEach(function (t) { t.stop(); }); }; rec.stop(); }
    rec = null; recStream = null;
  }
  function startUitschrift() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { $('opstat').textContent = 'Live uitschrijven kan niet in deze browser; het geluid wordt wel opgenomen.'; return; }
    var o = opname; herk = new SR(); herk.lang = 'nl-BE'; herk.continuous = true; herk.interimResults = false;
    herk.onresult = function (e) {
      for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) {
        var t = e.results[i][0].transcript.trim(); if (!t) continue;
        o.uitschrift.push({ sec: Math.round((Date.now() - Date.parse(o.start)) / 1000), tekst: t }); bewaarVan(o);
      }
    };
    herk.onend = function () { if (herk && opname === o) setTimeout(function () { try { herk.start(); } catch (e) {} }, 300); };
    herk.onerror = function (e) { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') herk = null; };
    try { herk.start(); } catch (e) {}
  }
  function mmss(s) { s = Math.max(0, s | 0); return (s / 3600 >= 1 ? Math.floor(s / 3600) + ':' : '') + ('0' + Math.floor(s / 60) % 60).slice(-2) + ':' + ('0' + s % 60).slice(-2); }
  function uitschriftTekst(o) {
    var r = [o.naam, 'Gids: ' + (o.audio.gids || '-') + ' · toestemming bevestigd op ' + o.audio.toestemming, ''], st = o.stops.slice(), u = (o.uitschrift || []).slice(), alle = [];
    st.forEach(function (s, i) { alle.push({ sec: s.sec || 0, r: '\n=== STOP ' + (i + 1) + ' [' + mmss(s.sec) + ']' + (s.notitie ? ' ' + s.notitie : '') + (s.bomen && s.bomen.length ? ' | dichtbij: ' + s.bomen.map(function (b) { return b.n; }).join(', ') : '') + ' ===' }); });
    u.forEach(function (x) { alle.push({ sec: x.sec, r: '[' + mmss(x.sec) + '] ' + x.tekst }); });
    alle.sort(function (a, b) { return a.sec - b.sec; });
    return r.concat(alle.map(function (a) { return a.r; })).join('\n') + '\n';
  }
  var CRC = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(bestanden) { // [{naam, data: Uint8Array}] zonder compressie
    var delen = [], centraal = [], off = 0, enc = new TextEncoder();
    bestanden.forEach(function (f) {
      var nm = enc.encode(f.naam), c = crc32(f.data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, c, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, nm.length, true);
      delen.push(h.buffer, nm, f.data);
      var z = new DataView(new ArrayBuffer(46));
      z.setUint32(0, 0x02014b50, true); z.setUint16(4, 20, true); z.setUint16(6, 20, true); z.setUint16(8, 0x0800, true); z.setUint32(16, c, true); z.setUint32(20, f.data.length, true); z.setUint32(24, f.data.length, true); z.setUint16(28, nm.length, true); z.setUint32(42, off, true);
      centraal.push(z.buffer, nm); off += 30 + nm.length + f.data.length;
    });
    var grootte = centraal.reduce(function (a, b) { return a + b.byteLength; }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, bestanden.length, true); e.setUint16(10, bestanden.length, true); e.setUint32(12, grootte, true); e.setUint32(16, off, true);
    return new Blob(delen.concat(centraal, [e.buffer]), { type: 'application/zip' });
  }
  function pakket(o, knop) {
    knop.disabled = true; knop.textContent = 'Bezig…';
    idbStukken(o.id).then(function (stukken) {
      return new Blob(stukken, { type: o.audio.mime }).arrayBuffer();
    }).then(function (ab) {
      var enc = new TextEncoder(), ext = /mp4/.test(o.audio.mime) ? 'm4a' : /ogg/.test(o.audio.mime) ? 'ogg' : 'webm';
      var naam = o.naam.replace(/[^\w-]+/g, '_');
      var z = zip([
        { naam: 'opname.json', data: enc.encode(JSON.stringify(o, null, 1)) },
        { naam: 'opname.gpx', data: enc.encode(gpx(o)) },
        { naam: 'uitschrift.txt', data: enc.encode(uitschriftTekst(o)) },
        { naam: 'geluid.' + ext, data: new Uint8Array(ab) }]);
      var f = new File([z], naam + '.zip', { type: 'application/zip' });
      knop.disabled = false; knop.textContent = 'Pakket (zip)';
      if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: o.naam }).catch(function (e) { if (e && e.name !== 'AbortError') dlBlob(f); });
      else dlBlob(f);
    }).catch(function () { knop.disabled = false; knop.textContent = 'Pakket (zip)'; $('opstat').textContent = 'Het pakket kon niet gemaakt worden.'; });
  }
  function dlBlob(f) { var a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }

  // ------------------------------------------------------------ GPS bijstellen ("ik sta hier bij stop 7")
  // Onder bomen wijkt de GPS vaak 10 à 30 m af in dezelfde richting. Sta je bij een gekende stop of boom, dan verschuift de
  // bijstelling alle volgende GPS-posities met dat verschil (tot 20 minuten of 400 m verder).
  var KAL = null;
  function kalibreer(lat, lon, naam) {
    if (!pos || pos.hand || !pos.ruw) { melding('Zet eerst de GPS aan (Waar ben ik?).'); return; }
    var d = afstand(pos.ruw, [lat, lon]);
    if (d > 80) { melding('De GPS zegt dat je ' + fmtM(d) + ' van ' + esc(naam) + ' bent. Dat is te ver om bij te stellen: kijk of je bij de juiste stop of boom staat.'); return; }
    KAL = { dlat: lat - pos.ruw[0], dlon: lon - pos.ruw[1], t: Date.now(), ruw: pos.ruw };
    nieuwePos({ coords: { latitude: pos.ruw[0], longitude: pos.ruw[1], accuracy: pos.acc } }, false);
    map.setView([lat, lon], Math.max(map.getZoom(), 18));
    melding('GPS bijgesteld met ' + fmtM(d) + ': je staat nu bij ' + esc(naam) + '. <button type="button" class="sec" data-kalweg="1">Ongedaan maken</button>');
  }

  // ------------------------------------------------------------ looprichting: pijl bij je positie en kaart die meedraait
  // Richting: tijdens het wandelen de bewegingsrichting (GPS-koers of de laatste meters), stilstaand het kompas van de gsm (als dat er is).
  var draai = { aan: false, hoek: 0, koers: null, koersT: 0, kompas: null, vorige: null };
  function hoekTussen(a, b) { var y = Math.sin((b[1] - a[1]) * RAD) * Math.cos(b[0] * RAD), x = Math.cos(a[0] * RAD) * Math.sin(b[0] * RAD) - Math.sin(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.cos((b[1] - a[1]) * RAD); return (Math.atan2(y, x) / RAD + 360) % 360; }
  function volgRichting(p) {
    var ll = [p.coords.latitude, p.coords.longitude];
    if (p.coords.heading != null && !isNaN(p.coords.heading) && (p.coords.speed || 0) > 0.6) { draai.koers = p.coords.heading; draai.koersT = Date.now(); }
    else if (draai.vorige && afstand(draai.vorige, ll) > 6 && afstand(draai.vorige, ll) > (p.coords.accuracy || 10) * 0.6) { draai.koers = hoekTussen(draai.vorige, ll); draai.koersT = Date.now(); draai.vorige = ll; }
    if (!draai.vorige || afstand(draai.vorige, ll) > 25) draai.vorige = ll;
  }
  function looprichting() {
    if (draai.koers != null && Date.now() - draai.koersT < 15000) return draai.koers;
    if (draai.kompas != null) return draai.kompas;
    return draai.koers;
  }
  function kompasEvent(e) {
    var h = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute && e.alpha != null ? 360 - e.alpha : null);
    if (h == null) return;
    var so = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    draai.kompas = (h + so + 360) % 360;
    if (!draai.kompasT || Date.now() - draai.kompasT > 250) { draai.kompasT = Date.now(); toonRichting(); }
  }
  function startKompas() {
    if (draai.kompasAan) return; draai.kompasAan = true;
    var luister = function () { window.addEventListener('deviceorientationabsolute', kompasEvent); window.addEventListener('deviceorientation', kompasEvent); };
    if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then(function (r) { if (r === 'granted') luister(); }).catch(function () {});
    else luister();
  }
  function toonRichting() {
    var h = looprichting(), pijl = document.getElementById('pospijl');
    if (pijl) { pijl.classList.toggle('geenrichting', h == null); if (h != null) pijl.style.transform = 'rotate(' + ((draai.aan ? 0 : h)) + 'deg)'; }
    if (draai.aan && h != null) {
      var d = ((-h - draai.hoek) % 360 + 540) % 360 - 180;   // kortste draai
      if (Math.abs(d) > 4) { draai.hoek += d; $('map').style.transform = 'rotate(' + draai.hoek + 'deg)'; }
      var nn = $('noordpijl'); if (nn) nn.style.transform = 'rotate(' + draai.hoek + 'deg)';
    }
  }
  function zetDraai(aan) {
    var w = $('mapwrap'), m = $('map'), c = map.getCenter(), z = map.getZoom();
    draai.aan = aan; w.classList.toggle('draai', aan); $('draaiknop').classList.toggle('aan', aan);
    $('draaiknop').title = aan ? 'Kaart draait mee (tik op de kaart om weer met het noorden boven te werken)' : 'Kaart laten meedraaien met je looprichting';
    if (aan) {
      var W = w.clientWidth, H = w.clientHeight, Dg = Math.ceil(Math.sqrt(W * W + H * H));
      m.style.width = Dg + 'px'; m.style.height = Dg + 'px'; m.style.left = ((W - Dg) / 2) + 'px'; m.style.top = ((H - Dg) / 2) + 'px';
      startKompas();
    } else { m.style.width = m.style.height = m.style.left = m.style.top = ''; m.style.transform = ''; draai.hoek = 0; }
    map.invalidateSize({ pan: false });
    map.setView(aan && pos ? pos.ll : c, aan ? Math.max(z, 18) : z, { animate: false });
    toonRichting();
  }
  function draaiInit() {
    var k = $('draaiknop'); if (!k) return;
    k.onclick = function () {
      if (!draai.aan && !pos) { melding('Zet eerst de GPS aan (Waar ben ik?).'); return; }
      zetDraai(!draai.aan); schrijf('arb-draai', draai.aan);
    };
    // tik je op de kaart terwijl ze gedraaid is, dan gaat ze terug naar 'noorden boven' zodat je normaal kan schuiven en tikken
    $('map').addEventListener('pointerdown', function () { if (draai.aan) { zetDraai(false); melding('Kaart staat weer met het noorden boven. Tik op 🧭 om ze opnieuw te laten meedraaien.'); setTimeout(function () { melding(''); }, 4000); } }, true);
  }

  // ------------------------------------------------------------ paden opnemen (werkt zonder internet)
  // Neem een pad op door het af te wandelen: punten om de 4 m (alleen als de GPS nauwkeuriger is dan 25 m). Alles blijft op de gsm
  // (localStorage) en wordt opgeladen naar data/eigen_paden.json zodra er internet is en de GitHub-sleutel op het toestel staat.
  var PAD = null, padLijn = null;
  function padPopup(l) {
    var ll = l.getCenter ? l.getCenter() : null;
    return '<b>Pad</b><div class="pk"><button class="sec" type="button" data-padweg="' + (ll ? ll.lat.toFixed(6) + ',' + ll.lng.toFixed(6) : '') + '">Dit pad bestaat niet (meer)</button></div><p class="muted">Tik eerst zo dicht mogelijk bij de plek waar het pad niet klopt.</p>';
  }
  function padStart() {
    if (PAD) return;
    if (watchId === null) wisselGps();
    PAD = { id: Date.now(), soort: 'klein', pts: [], start: new Date().toISOString() };
    schrijf('arb-pad-bezig', PAD);
    if (navigator.wakeLock && !wakeLock) navigator.wakeLock.request('screen').then(function (w) { wakeLock = w; }).catch(function () {});
    toonPadPaneel();
  }
  function padPunt() {
    if (!PAD || !pos || pos.hand || pos.acc > 25) return;
    var l = PAD.pts[PAD.pts.length - 1];
    if (l && afstand(l, pos.ll) < 4) return;
    PAD.pts.push([+pos.ll[0].toFixed(6), +pos.ll[1].toFixed(6)]);
    schrijf('arb-pad-bezig', PAD);
    if (!padLijn) padLijn = L.polyline(PAD.pts, { color: '#e65100', weight: 5, dashArray: '8 6' }).addTo(map); else padLijn.setLatLngs(PAD.pts);
    toonPadPaneel();
  }
  function padLengte(pts) { var m = 0; for (var i = 1; i < pts.length; i++) m += afstand(pts[i - 1], pts[i]); return m; }
  function toonPadPaneel() {
    var el = $('padopname'); if (!el) return;
    if (!PAD) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<h2>〰️ Pad opnemen</h2><p>Wandel het pad af. <b>' + PAD.pts.length + '</b> punten · ' + fmtM(padLengte(PAD.pts)) + (pos && pos.acc > 25 ? ' · <span class="rood">GPS te onnauwkeurig (± ' + Math.round(pos.acc) + ' m), even wachten</span>' : '') + '</p>' +
      '<p class="muted">Werkt zonder internet. Laat het scherm aan (anders stopt de GPS). Begin en eindig op een bestaand pad of kruispunt.</p>' +
      '<label>Soort pad <select id="pad-soort"><option value="klein">klein pad / bospad</option><option value="groot">groot pad / dreef</option><option value="weide">pad over of langs een weide</option><option value="trap">trap of steil pad</option></select></label>' +
      '<label>Opmerking <input id="pad-opm" placeholder="bv. modderig na regen"></label>' +
      '<div class="d-acties"><button type="button" class="knop hoofd" id="pad-ok">Stop en bewaar</button><button type="button" id="pad-weg">Annuleren</button></div>';
    $('pad-soort').value = PAD.soort || 'klein'; $('pad-soort').onchange = function () { PAD.soort = this.value; schrijf('arb-pad-bezig', PAD); };
    if (PAD.opm) $('pad-opm').value = PAD.opm; $('pad-opm').onchange = function () { PAD.opm = this.value; schrijf('arb-pad-bezig', PAD); };
    $('pad-weg').onclick = function () { if (PAD.pts.length > 5 && !confirm('Dit opgenomen pad weggooien?')) return; padStop(); };
    $('pad-ok').onclick = function () {
      if (PAD.pts.length < 3 || padLengte(PAD.pts) < 10) { melding('Het pad is nog te kort om te bewaren.'); return; }
      var p = { id: PAD.id, soort: PAD.soort, opm: PAD.opm || '', datum: PAD.start.slice(0, 10), pts: PAD.pts };
      var q = lees('arb-padwachtrij', []); q.push(p); schrijf('arb-padwachtrij', q);
      L.polyline(p.pts, { color: '#e65100', weight: 3.5 }).bindPopup('<b>Eigen pad</b> (nog niet opgeladen)').addTo(lagen.paden);
      padStop(); melding('Pad bewaard op dit toestel (' + fmtM(padLengte(p.pts)) + ').'); synchroniseer();
    };
  }
  function padStop() { PAD = null; localStorage.removeItem('arb-pad-bezig'); if (padLijn) { map.removeLayer(padLijn); padLijn = null; } if (wakeLock && !opname) { wakeLock.release().catch(function () {}); wakeLock = null; } toonPadPaneel(); }

  // ------------------------------------------------------------ wachtende gegevens opladen zodra er internet is
  var SYNC = [['arb-boomwachtrij', 'data/extra_bomen.json', 'boom'], ['arb-bankwachtrij', 'data/zitbanken_extra.json', 'zitbank'], ['arb-padwachtrij', 'data/eigen_paden.json', 'pad'], ['arb-padwegwachtrij', 'data/paden_weg.json', 'melding van een pad dat niet bestaat']];
  var bezigSync = false;
  function wachtend() { return SYNC.reduce(function (n, s) { return n + lees(s[0], []).length; }, 0); }
  function synchroniseer() {
    var n = wachtend(), k = $('syncinfo');
    if (k) { k.hidden = !n; k.innerHTML = n ? '⏳ ' + n + ' gegeven' + (n > 1 ? 's' : '') + ' wacht' + (n > 1 ? 'en' : '') + ' op opladen' + (lees('arb-gh-token', '') ? (navigator.onLine === false ? ' (geen internet)' : '') : ' (geen GitHub-sleutel op dit toestel: open de beheerpagina)') : ''; }
    if (!n || bezigSync || !lees('arb-gh-token', '') || navigator.onLine === false) return;
    bezigSync = true; var ok = 0;
    SYNC.reduce(function (p, s) {
      return p.then(function () {
        var q = lees(s[0], []);
        return q.reduce(function (pp, item) {
          return pp.then(function () { return bewaarInRepo(s[1], item, 'Ter plaatse: ' + s[2] + ' toegevoegd').then(function () { var r = lees(s[0], []).filter(function (x) { return JSON.stringify(x) !== JSON.stringify(item); }); schrijf(s[0], r); ok++; }); });
        }, Promise.resolve());
      });
    }, Promise.resolve()).then(function () { bezigSync = false; if (ok) melding('✓ ' + ok + ' wachtend' + (ok > 1 ? 'e gegevens' : ' gegeven') + ' opgeladen. Binnen een à twee minuten staan ze online.'); synchroniseer(); })
      .catch(function () { bezigSync = false; var k2 = $('syncinfo'); if (k2) k2.innerHTML += ' · opladen lukte nog niet, later opnieuw'; });
  }

  // ------------------------------------------------------------ zitbanken (OpenStreetMap + ter plaatse toegevoegd)
  var BANKEN = [];
  var BANKICOON = null;
  function toonBank(z) {
    if (!BANKICOON) BANKICOON = L.divIcon({ className: 'bank', html: '<span>🪑</span>', iconSize: [20, 20], iconAnchor: [10, 10] });
    L.marker([z.lat, z.lon], { icon: BANKICOON, keyboard: false }).bindPopup('<b>Zitbank</b>' + (z.rug === 'yes' ? ' met rugleuning' : z.rug === 'no' ? ' zonder rugleuning' : '') +
      (z.mat === 'wood' ? ', hout' : z.mat === 'stone' ? ', steen' : '') + (z.opm ? '<br>' + esc(z.opm) : '') + '<br><span class="muted">' + (z.bron === 'OSM' ? 'bron: OpenStreetMap' : 'ter plaatse toegevoegd') + '</span>').addTo(lagen.banken);
  }
  function bewaarInRepo(pad, item, boodschap) {
    var token = lees('arb-gh-token', ''); if (!token) return Promise.reject(new Error('geen sleutel'));
    var api = 'https://api.github.com/repos/sdweerdt-bot/arboretum-tervuren/contents/' + pad, h = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
    return fetch(api + '?ref=main', { headers: h, cache: 'no-store' }).then(function (r) { return r.status === 404 ? null : r.ok ? r.json() : Promise.reject(new Error('lezen: ' + r.status)); }).then(function (f) {
      var lijst = f ? JSON.parse(decodeURIComponent(escape(atob(f.content.replace(/\s/g, ''))))) : [];
      lijst.push(item);
      var body = { message: boodschap, content: btoa(unescape(encodeURIComponent(JSON.stringify(lijst).replace(/\},\{/g, '},\n{')))), branch: 'main' };
      if (f) body.sha = f.sha;
      return fetch(api, { method: 'PUT', headers: h, body: JSON.stringify(body) });
    }).then(function (r) { if (!r.ok) throw new Error('bewaren: ' + r.status); });
  }
  function bankPlus() {
    if (!pos) { melding('Zet eerst de GPS aan (Waar ben ik?) en ga bij de zitbank staan.'); return; }
    for (var i = 0; i < BANKEN.length; i++) if (afstand(pos.ll, [BANKEN[i].lat, BANKEN[i].lon]) < 6) { melding('Er staat al een zitbank op de kaart op ' + Math.round(afstand(pos.ll, [BANKEN[i].lat, BANKEN[i].lon])) + ' m van je.'); return; }
    var rug = confirm('Zitbank toevoegen op je huidige plaats.\n\nHeeft de bank een rugleuning? (OK = ja, Annuleren = nee)');
    var z = { lat: +pos.ll[0].toFixed(6), lon: +pos.ll[1].toFixed(6), acc: pos.acc ? Math.round(pos.acc) : null, rug: rug ? 'yes' : 'no', datum: new Date().toISOString().slice(0, 10), bron: 'ter plaatse' };
    BANKEN.push(z); toonBank(z);
    var tekst = 'Zitbank · ' + z.lat + ', ' + z.lon;
    bewaarInRepo('data/zitbanken_extra.json', z, 'Zitbank toegevoegd ter plaatse').then(function () {
      melding('✓ Zitbank bewaard. Ze staat nu op jouw kaart en binnen een à twee minuten voor iedereen.');
    }).catch(function (e) {
      var q = lees('arb-bankwachtrij', []); q.push(z); schrijf('arb-bankwachtrij', q);
      melding((e.message === 'geen sleutel' ? 'Bewaard op dit toestel (geen GitHub-sleutel hier).' : 'Opladen lukte niet (' + esc(e.message) + ').') + ' Stuur deze gegevens door: <b>' + esc(tekst) + '</b>');
    });
  }

  // ------------------------------------------------------------ ontbrekende boom toevoegen (ter plaatse, met de GPS)
  // Met de GitHub-sleutel van de beheerpagina op dit toestel komt de boom meteen in data/extra_bomen.json (zichtbaar na 1-2 min);
  // zonder sleutel blijft hij op dit toestel en toont de pagina de gegevens om door te sturen.
  function taxonIndex(n) { for (var i = 0; i < D.taxa.length; i++) if (D.taxa[i][1] === n) return i; return -1; }
  function slugVan(n) { return n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/×/g, 'x').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function voegExtraToe(x) {
    var ti = taxonIndex(x.n);
    if (ti < 0) { D.taxa.push([slugVan(x.n), x.n, x.nl || '', x.naald ? 1 : 0, '', 1]); ti = D.taxa.length - 1; }   // nieuwe soort (nog geen fiche tot de volgende build)
    for (var i = 0; i < D.bomen.length; i++) if (D.bomen[i][0] === ti && afstand([D.bomen[i][2], D.bomen[i][3]], [x.lat, x.lon]) < 3) return null;   // staat er al (na een nieuwe build)
    var b = [ti, x.g || '', x.lat, x.lon, x.om || 0, x.j || 0]; D.bomen.push(b); return b;
  }
  function toonExtra(b) {
    if (!b || !lagen.bomen) return;
    var t = D.taxa[b[0]], i = D.bomen.indexOf(b);
    L.circleMarker([b[2], b[3]], { radius: 6, color: '#fff', weight: 2, fillColor: kleur(t[3]), fillOpacity: 1 }).bindPopup(function () { return popupStand(i, 'boom', b); }).addTo(lagen.bomen);
  }
  function boomPlus() {
    var el = $('boomplus'); if (!el) return;
    if (!pos) { melding('Zet eerst de GPS aan (Waar ben ik?) of tik zelf op de kaart, en ga bij de boom staan.'); return; }
    var opties = D.taxa.map(function (t) { return '<option value="' + esc(t[1]) + '">' + esc(t[2] || '') + '</option>'; }).join('');
    el.hidden = false;
    el.innerHTML = '<h2>Ontbrekende boom toevoegen</h2><p class="muted">Ga zo dicht mogelijk bij de stam staan. Positie: ' + pos.ll[0].toFixed(6) + ', ' + pos.ll[1].toFixed(6) + (pos.acc ? ' (± ' + Math.round(pos.acc) + ' m)' : '') + '</p>' +
      '<label>Soort (wetenschappelijke naam) <input id="bp-n" list="bp-lijst" autocomplete="off" placeholder="bv. Quercus frainetto"></label><datalist id="bp-lijst">' + opties + '</datalist>' +
      '<div id="bp-nieuw" hidden><p class="muted">Deze soort staat nog niet in de gids: ze wordt als nieuwe soort toegevoegd.</p><label>Nederlandse naam (als je die kent) <input id="bp-nl" placeholder="bv. Chinese parasolboom"></label><label class="vink"><input type="checkbox" id="bp-naald"> naaldboom</label></div>' +
      '<label>Plantjaar <input id="bp-j" inputmode="numeric" placeholder="bv. 1908"></label><label>Omtrek in cm (op 1,50 m) <input id="bp-om" inputmode="numeric" placeholder="bv. 290"></label>' +
      '<label>Opmerking <input id="bp-opm" placeholder="bv. mooi groot exemplaar"></label>' +
      '<div class="d-acties"><button type="button" class="knop hoofd" id="bp-ok">Boom bewaren</button><button type="button" id="bp-weg">Annuleren</button></div><p id="bp-stat" class="muted"></p>';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('bp-weg').onclick = function () { el.hidden = true; el.innerHTML = ''; };
    $('bp-n').oninput = function () { var v = this.value.trim(); $('bp-nieuw').hidden = !(v.indexOf(' ') > 0 && taxonIndex(v) < 0 && v.length > 6); $('bp-stat').textContent = ''; };
    $('bp-ok').onclick = function () {
      var n = $('bp-n').value.trim().replace(/\s+/g, ' ');
      if (!/^[A-Z][a-z-]+ (×\s?|x )?[a-z-]+/.test(n)) { $('bp-stat').textContent = 'Geef de wetenschappelijke naam: geslacht met hoofdletter en soort, bv. Firmiana simplex.'; return; }
      var nieuw = taxonIndex(n) < 0;
      if (nieuw && $('bp-nieuw').hidden) { $('bp-nieuw').hidden = false; $('bp-stat').textContent = 'Nieuwe soort: vul eventueel de Nederlandse naam aan en tik nog eens op Boom bewaren.'; return; }
      var x = { n: n, lat: +pos.ll[0].toFixed(6), lon: +pos.ll[1].toFixed(6), acc: pos.acc ? Math.round(pos.acc) : null, j: parseInt($('bp-j').value, 10) || 0, om: parseInt($('bp-om').value, 10) || 0,
        opm: $('bp-opm').value.trim(), datum: new Date().toISOString().slice(0, 10), bron: 'ter plaatse toegevoegd' };
      if (nieuw) { x.nieuw = 1; x.nl = $('bp-nl').value.trim(); x.naald = $('bp-naald').checked ? 1 : 0; }
      var tekst = x.n + ' · ' + x.lat + ', ' + x.lon + (x.j ? ' · geplant ' + x.j : '') + (x.om ? ' · omtrek ' + x.om + ' cm' : '') + (x.opm ? ' · ' + x.opm : '');
      toonExtra(voegExtraToe(x));
      var token = lees('arb-gh-token', '');
      if (!token) {
        var q = lees('arb-boomwachtrij', []); q.push(x); schrijf('arb-boomwachtrij', q);
        $('bp-stat').innerHTML = 'Bewaard op dit toestel (geen GitHub-sleutel hier). Stuur deze gegevens door om de boom op de kaart te zetten:<br><b>' + esc(tekst) + '</b>';
        return;
      }
      $('bp-stat').textContent = 'Opladen…';
      var api = 'https://api.github.com/repos/sdweerdt-bot/arboretum-tervuren/contents/data/extra_bomen.json', h = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
      fetch(api + '?ref=main', { headers: h, cache: 'no-store' }).then(function (r) { return r.status === 404 ? null : r.ok ? r.json() : Promise.reject(new Error('lezen: ' + r.status)); }).then(function (f) {
        var lijst = f ? JSON.parse(decodeURIComponent(escape(atob(f.content.replace(/\s/g, ''))))) : [];
        lijst.push(x);
        var body = { message: 'Boom toegevoegd ter plaatse: ' + x.n, content: btoa(unescape(encodeURIComponent(JSON.stringify(lijst, null, 0).replace(/\},\{/g, '},\n{')))), branch: 'main' };
        if (f) body.sha = f.sha;
        return fetch(api, { method: 'PUT', headers: h, body: JSON.stringify(body) });
      }).then(function (r) {
        if (!r.ok) throw new Error('bewaren: ' + r.status);
        $('bp-stat').innerHTML = '✓ Bewaard. De boom staat nu op jouw kaart en binnen een à twee minuten voor iedereen.<br>' + esc(tekst);
      }).catch(function (e) {
        var q = lees('arb-boomwachtrij', []); q.push(x); schrijf('arb-boomwachtrij', q);
        $('bp-stat').innerHTML = 'Opladen lukte niet (' + esc(e.message) + '). Bewaard op dit toestel; stuur deze gegevens door:<br><b>' + esc(tekst) + '</b>';
      });
    };
  }

  // ------------------------------------------------------------ opstart
  Promise.all([fetch(ROOT + 'data/arboretum.json').then(function (r) { return r.json(); }), fetch(ROOT + 'data/wandelingen.json').then(function (r) { return r.json(); }),
    fetch(ROOT + 'data/extra_bomen.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })])
    .then(function (x) {
      D = x[0]; WAND = x[1]; (x[2] || []).concat(lees('arb-boomwachtrij', [])).forEach(voegExtraToe);
      fetch(ROOT + 'data/eigen_paden.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (ep) {
        var w2 = setInterval(function () { if (lagen.paden) { clearInterval(w2); ep.concat(lees('arb-padwachtrij', [])).forEach(function (p) { L.polyline(p.pts, { color: '#e65100', weight: 3.5, opacity: 0.95 }).bindPopup('<b>Eigen pad</b> · ' + esc(p.soort || '') + (p.opm ? '<br>' + esc(p.opm) : '') + '<br><span class="muted">opgenomen ' + esc(p.datum || '') + '</span>').addTo(lagen.paden); }); } }, 200);
      });
      Promise.all(['zitbanken.json', 'zitbanken_extra.json'].map(function (f) { return fetch(ROOT + 'data/' + f, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }); }))
        .then(function (z) { BANKEN = z[0].concat(z[1], lees('arb-bankwachtrij', [])); var w = setInterval(function () { if (lagen.banken) { clearInterval(w); BANKEN.forEach(toonBank); } }, 200); });
      if (window.L && L.map) start(); else window.addEventListener('leaflet-klaar', start, { once: true });
    }).catch(function () { melding('De kaartgegevens konden niet geladen worden.'); });
})();
