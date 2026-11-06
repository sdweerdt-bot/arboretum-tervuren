// Beheer van de wandelingen: bewerken, nieuwe maken, opname omzetten, publiceren naar GitHub.
(function () {
  'use strict';
  var ROOT = document.body.dataset.root || '../';
  var REPO = 'sdweerdt-bot/arboretum-tervuren', PAD = 'data/wandelingen.json', TAK = 'main';
  var START = { naam: 'Eikestraat 102, 3080 Tervuren', lat: 50.8106568, lon: 4.5076615 };
  var KLEUREN = ['#2E7D32', '#795548', '#7B1FA2', '#E65100', '#1565C0', '#C62828', '#00695C', '#283593', '#EF6C00', '#8D6E4A', '#C0CA33', '#AD1457'];
  var $ = function (id) { return document.getElementById(id); };
  var D, PG, W = [], cur = 0, map, lagen = {}, kiesModus = false, padIdx = null;
  var R = 6371008.8, RAD = Math.PI / 180;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function afst(a, b) { var x = (b[1] - a[1]) * RAD * Math.cos((a[0] + b[0]) / 2 * RAD), y = (b[0] - a[0]) * RAD; return Math.sqrt(x * x + y * y) * R; }
  function lees(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function schrijf(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function slug(s) { return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'wandeling'; }
  function melding(t, fout) { var m = $('bmeld'); m.innerHTML = t; m.className = 'melding' + (fout ? ' fout' : ''); m.hidden = !t; }
  function w() { return W[cur]; }
  function lengte(r) { var s = 0; for (var i = 1; i < r.length; i++) s += afst(r[i - 1], r[i]); return Math.round(s); }

  // ------------------------------------------------------------ standplaatsen per soort
  var TAX = {}, NAAM2I = {};
  function indexeer() {
    D.taxa.forEach(function (t, i) { TAX[i] = { i: i, slug: t[0], n: t[1], nl: t[2], eik: t[4] || '', st: [] }; NAAM2I[t[1].toLowerCase()] = i; if (t[2]) NAAM2I[(t[1] + ' – ' + t[2]).toLowerCase()] = i; });
    D.bomen.forEach(function (b) { TAX[b[0]].st.push({ soort: 'boom', g: b[1], lat: b[2], lon: b[3], om: b[4], j: b[5], n: 1 }); });
    D.reeksen.forEach(function (r) { TAX[r[0]].st.push({ soort: 'reeks', g: r[1], lat: r[2], lon: r[3], om: r[7], j: r[8], n: r[6] }); });
    $('soortenlijst').innerHTML = D.taxa.map(function (t) { return '<option value="' + esc(t[1] + (t[2] ? ' – ' + t[2] : '')) + '">'; }).join('');
  }
  function stLabel(s) { return 'groep ' + (s.g || '–') + ' · ' + (s.soort === 'reeks' ? 'reeks van ' + s.n : 'boom') + (s.j ? ' · ' + s.j : '') + (s.om ? ' · ' + s.om + ' cm' : ''); }
  function stopVan(ti, s, oud) {
    var t = TAX[ti];
    return { eik: t.eik, slug: t.slug, n: t.n, nl: t.nl, titel: (oud && oud.titel) || t.nl || t.n, tekst: (oud && oud.tekst) || '',
      lat: s.lat, lon: s.lon, g: s.g, om: s.om || 0, j: s.j || 0, soort: s.soort, aantal: s.n || 1 };
  }
  function stopVanMet(ti, s, oud) {   // behoudt gidsteksten, foto's en links
    var n = stopVan(ti, s, oud);
    ['hoofdstuk', 'verhaal', 'kijk', 'weetje', 'vraag', 'antwoord', 'brug', 'fotos', 'meer'].forEach(function (k) { if (oud && oud[k]) n[k] = oud[k]; });
    return n;
  }
  function dichtsteStand(p, max) {
    var best = null;
    Object.keys(TAX).forEach(function (k) { TAX[k].st.forEach(function (s) { var d = afst(p, [s.lat, s.lon]); if (d <= max && (!best || d < best.d)) best = { d: d, ti: +k, s: s }; }); });
    return best;
  }

  // ------------------------------------------------------------ route langs de paden
  function bouwGraaf() {
    padIdx = { adj: PG.n.map(function () { return []; }) };
    PG.e.forEach(function (e) { padIdx.adj[e[0]].push([e[1], e[2]]); padIdx.adj[e[1]].push([e[0], e[2]]); });
  }
  function dichtsteKnoop(p) { var b = 0, bd = 1e18; PG.n.forEach(function (q, i) { var d = afst(p, q); if (d < bd) { bd = d; b = i; } }); return [b, bd]; }
  function pad(a, b) {
    var A = dichtsteKnoop(a), B = dichtsteKnoop(b), D_ = {}, prev = {}, open = [[0, A[0]]], klaar = {};
    D_[A[0]] = 0;
    function push(it) { open.push(it); var i = open.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; var t = open[p]; open[p] = open[i]; open[i] = t; i = p; } }
    function pop() { var top = open[0], last = open.pop(); if (open.length) { open[0] = last; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; var t = open[m]; open[m] = open[i]; open[i] = t; i = m; } } return top; }
    while (open.length) {
      var c = pop(), n = c[1];
      if (klaar[n]) continue; klaar[n] = 1;
      if (n === B[0]) break;
      padIdx.adj[n].forEach(function (e) { var nd = c[0] + e[1]; if (D_[e[0]] === undefined || nd < D_[e[0]]) { D_[e[0]] = nd; prev[e[0]] = n; push([nd, e[0]]); } });
    }
    var recht = afst(a, b);
    if (D_[B[0]] === undefined || D_[B[0]] + A[1] + B[1] > 3.5 * recht + 150) return { d: recht * 1.25, p: [a, b] };
    var seq = [B[0]]; while (seq[seq.length - 1] !== A[0]) seq.push(prev[seq[seq.length - 1]]);
    return { d: D_[B[0]] + A[1] + B[1], p: [a].concat(seq.reverse().map(function (i) { return PG.n[i]; }), [b]) };
  }
  function berekenRoute() {
    var x = w(), pts = [[x.start.lat, x.start.lon]].concat(x.stops.map(function (s) { return [s.lat, s.lon]; }), [[x.start.lat, x.start.lon]]), r = [];
    for (var i = 1; i < pts.length; i++) { var p = pad(pts[i - 1], pts[i]).p; r = r.concat(r.length ? p.slice(1) : p); }
    x.route = r.map(function (p) { return [+p[0].toFixed(6), +p[1].toFixed(6)]; }); x.lengte = lengte(x.route); x.routeBron = 'paden';
  }
  function optimaliseer() {
    var x = w(), pts = [[x.start.lat, x.start.lon]].concat(x.stops.map(function (s) { return [s.lat, s.lon]; })), n = pts.length, A = [];
    for (var i = 0; i < n; i++) { A.push([]); for (var j = 0; j < n; j++) A[i].push(i === j ? 0 : afst(pts[i], pts[j])); }
    var o = [0], rest = []; for (i = 1; i < n; i++) rest.push(i);
    while (rest.length) { var l = o[o.length - 1]; rest.sort(function (a, b) { return A[l][a] - A[l][b]; }); o.push(rest.shift()); }
    function L(o) { var s = 0; for (var i = 0; i < o.length; i++) s += A[o[i]][o[(i + 1) % o.length]]; return s; }
    var beter = true;
    while (beter) { beter = false; for (i = 1; i < n - 1; i++) for (j = i + 1; j < n; j++) { var nw = o.slice(0, i).concat(o.slice(i, j + 1).reverse(), o.slice(j + 1)); if (L(nw) < L(o) - 0.01) { o = nw; beter = true; } } }
    x.stops = o.slice(1).map(function (k) { return x.stops[k - 1]; });
    berekenRoute();
  }

  // ------------------------------------------------------------ formulier
  function lijstWandelingen() {
    $('wkeuze').innerHTML = W.map(function (x, i) { return '<option value="' + i + '">' + esc(x.titel) + (x.verborgen ? ' (verborgen)' : '') + (x.soort === 'officieel' ? ' · lus' : '') + '</option>'; }).join('');
    $('wkeuze').value = cur;
  }
  var GV = [['hoofdstuk', 'Hoofdstuk (bv. 1823 · Aankomst)', 1], ['verhaal', 'Vertel (lege regel = nieuwe alinea)', 6], ['kijk', 'Kijk en wijs aan', 3], ['weetje', 'Weetje', 2], ['vraag', 'Vraag aan de groep', 1], ['antwoord', 'Antwoord', 1], ['brug', 'Brug naar de volgende stop', 2]];
  function toon() {
    var x = w(); if (!x) return;
    $('f-titel').value = x.titel || ''; $('f-id').textContent = x.id; $('f-kleur').value = x.kleur || '#2E7D32';
    $('f-seizoen').value = x.seizoen || ''; $('f-intro').value = x.intro || ''; $('f-soort').value = x.soort || 'thema';
    $('f-folder').value = x.folder || ''; $('f-verborgen').checked = !!x.verborgen;
    ['rodedraad', 'praktisch', 'afsluiter'].forEach(function (k) { $('f-' + k).value = x[k] || ''; });
    var tz = x.teaser || {}; ['kop','tekst','datum','uur','prijs','duur','inschrijven','meebrengen'].forEach(function (k) { $('t-' + k).value = tz[k] || ''; });
    $('f-teaserlink').href = ROOT + 'teaser/?w=' + x.id;
    $('f-folderrij').hidden = (x.soort !== 'officieel');
    $('f-info').textContent = x.stops.length + ' stops · ' + (x.lengte / 1000).toFixed(1).replace('.', ',') + ' km · route: ' + (x.routeBron === 'opname' ? 'opgenomen GPS-spoor' : 'langs de paden');
    $('f-link').href = ROOT + 'wandeling/?w=' + x.id;
    $('stops').innerHTML = x.stops.map(function (s, i) {
      var ti = NAAM2I[s.n.toLowerCase()], opts = ti === undefined ? '' : TAX[ti].st.map(function (st, k) {
        var sel = Math.abs(st.lat - s.lat) < 1e-6 && Math.abs(st.lon - s.lon) < 1e-6;
        return '<option value="' + k + '"' + (sel ? ' selected' : '') + '>' + esc(stLabel(st)) + '</option>';
      }).join('');
      return '<li class="bstop" data-i="' + i + '"><div class="bkop"><span class="bnr" style="background:' + x.kleur + '">' + (i + 1) + '</span>' +
        '<input class="b-titel" value="' + esc(s.titel) + '" aria-label="Titel van stop ' + (i + 1) + '">' +
        '<button type="button" data-a="op" title="omhoog">↑</button><button type="button" data-a="neer" title="omlaag">↓</button><button type="button" data-a="weg" title="verwijderen">✕</button></div>' +
        '<label>Soort<input class="b-soort" list="soortenlijst" value="' + esc(s.n + (s.nl ? ' – ' + s.nl : '')) + '"></label>' +
        '<label>Standplaats<select class="b-stand">' + opts + '</select></label>' +
        '<label>Korte uitleg<textarea class="b-tekst" rows="3">' + esc(s.tekst) + '</textarea></label>' +
        '<details class="bgids"' + (s.verhaal ? ' open' : '') + '><summary>Gidstekst (verhaal, kijk, weetje, vraag, brug)</summary>' +
        GV.map(function (g) { return '<label>' + g[1] + '<textarea class="b-gv" data-k="' + g[0] + '" rows="' + g[2] + '">' + esc(s[g[0]] || '') + '</textarea></label>'; }).join('') + '</details>' +
        '<div class="bfotos">' + (s.fotos || []).map(function (f, k) {
          return '<figure class="bfoto"><img src="' + (f.src.indexOf('data:') === 0 ? f.src : ROOT + f.src) + '" alt="">' + (f.src.indexOf('data:') === 0 ? '<span class="bnieuw">nog niet online</span>' : '') +
            '<input class="b-fbij" data-f="' + k + '" value="' + esc(f.bijschrift || '') + '" placeholder="Bijschrift (optioneel)" aria-label="Bijschrift foto ' + (k + 1) + '">' +
            '<button type="button" data-a="fweg" data-f="' + k + '" title="foto verwijderen">✕</button></figure>';
        }).join('') + '</div>' +
        '<label class="kn bfotoknop">+ Foto toevoegen<input type="file" class="b-foto" accept="image/*" multiple hidden></label>' +
        '<div class="d-acties"><button type="button" data-a="toon">Toon op kaart</button><a class="kn" href="' + ROOT + 'soort/' + s.slug + '/" target="_blank">Fiche</a></div></li>';
    }).join('') || '<li class="los">Nog geen stops. Tik op <b>Stop toevoegen</b> en dan op de kaart bij een boom.</li>';
    tekenKaart(); bewaarConcept();
  }
  function leesFormulier() {
    var x = w();
    x.titel = $('f-titel').value.trim() || 'Nieuwe wandeling'; x.kleur = $('f-kleur').value; x.seizoen = $('f-seizoen').value.trim();
    x.intro = $('f-intro').value.trim(); x.soort = $('f-soort').value; x.folder = $('f-folder').value.trim(); x.verborgen = $('f-verborgen').checked;
    if (!x.verborgen) delete x.verborgen;
    ['rodedraad', 'praktisch', 'afsluiter'].forEach(function (k) { var v = $('f-' + k).value.trim(); if (v !== (x[k] || '')) delete x.gidsauto; if (v) x[k] = v; else delete x[k]; });
    var tz = x.teaser || {}; ['kop','tekst','datum','uur','prijs','duur','inschrijven','meebrengen'].forEach(function (k) { tz[k] = $('t-' + k).value.trim(); });
    x.teaser = tz;
  }
  function wijzigStop(e) {
    var li = e.target.closest('.bstop'); if (!li) return;
    var x = w(), i = +li.dataset.i, s = x.stops[i];
    if (e.target.classList.contains('b-titel')) s.titel = e.target.value;
    if (e.target.classList.contains('b-tekst')) s.tekst = e.target.value;
    if (e.target.classList.contains('b-gv')) { var gk = e.target.dataset.k, gv = e.target.value; if (gv.trim()) s[gk] = gv; else delete s[gk]; delete s.gidsauto; }
    if (e.target.classList.contains('b-fbij')) s.fotos[+e.target.dataset.f].bijschrift = e.target.value;
    if (e.target.classList.contains('b-foto') && e.type === 'change') { voegFotosToe(x, s, e.target.files); e.target.value = ''; return; }
    if (e.target.classList.contains('b-soort') && e.type === 'change') {
      var ti = NAAM2I[e.target.value.toLowerCase()] !== undefined ? NAAM2I[e.target.value.toLowerCase()] : NAAM2I[e.target.value.split(' – ')[0].toLowerCase()];
      if (ti === undefined) { melding('Soort "' + esc(e.target.value) + '" niet gevonden in het arboretum.', true); return; }
      var best = TAX[ti].st.slice().sort(function (a, b) { return afst([s.lat, s.lon], [a.lat, a.lon]) - afst([s.lat, s.lon], [b.lat, b.lon]); })[0];
      var titelWasNaam = s.titel === s.nl || s.titel === s.n;
      x.stops[i] = stopVanMet(ti, best, Object.assign({}, s, { titel: titelWasNaam ? '' : s.titel })); berekenRoute(); toon();
    }
    if (e.target.classList.contains('b-stand')) {
      var t2 = NAAM2I[s.n.toLowerCase()], st = TAX[t2].st[+e.target.value];
      x.stops[i] = stopVanMet(t2, st, s); berekenRoute(); toon();
    }
    bewaarConcept();
  }
  function stopKnop(e) {
    var b = e.target.closest('button[data-a]'); if (!b) return;
    var li = b.closest('.bstop'), x = w(), i = +li.dataset.i, a = b.dataset.a;
    if (a === 'op' && i > 0) { var t = x.stops[i - 1]; x.stops[i - 1] = x.stops[i]; x.stops[i] = t; berekenRoute(); toon(); }
    if (a === 'neer' && i < x.stops.length - 1) { t = x.stops[i + 1]; x.stops[i + 1] = x.stops[i]; x.stops[i] = t; berekenRoute(); toon(); }
    if (a === 'weg' && confirm('Stop ' + (i + 1) + ' (' + x.stops[i].titel + ') verwijderen?')) { x.stops.splice(i, 1); berekenRoute(); toon(); }
    if (a === 'fweg' && confirm('Deze foto weghalen bij de stop?')) { x.stops[i].fotos.splice(+b.dataset.f, 1); toon(); }
    if (a === 'toon') { map.setView([x.stops[i].lat, x.stops[i].lon], 19); $('bkaart').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  // ------------------------------------------------------------ kaart
  function tekenKaart() {
    var x = w();
    lagen.w.clearLayers();
    L.polyline(x.route, { color: x.kleur, weight: 5, opacity: 0.8, interactive: false }).addTo(lagen.w);
    L.marker([x.start.lat, x.start.lon], { icon: L.divIcon({ className: 'stopnr', html: '<span style="background:#0b4a45;border-radius:6px">S</span>', iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(lagen.w);
    x.stops.forEach(function (s, i) {
      L.marker([s.lat, s.lon], { icon: L.divIcon({ className: 'stopnr', html: '<span style="background:' + x.kleur + '">' + (i + 1) + '</span>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
        .bindPopup('<b>' + (i + 1) + '. ' + esc(s.titel) + '</b><br><i>' + esc(s.n) + '</i>').addTo(lagen.w);
    });
  }
  function startKaart() {
    map = L.map('bkaart', { renderer: L.canvas({ padding: 0.5, tolerance: 8 }), maxZoom: 20 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap · bomen: arboretum-tervuren.be' }).addTo(map);
    map.fitBounds(D.bounds);
    lagen.b = L.layerGroup().addTo(map); lagen.w = L.layerGroup().addTo(map);
    D.reeksen.forEach(function (r) {
      var dy = r[5] / (RAD * R), dx = r[4] / (RAD * R * Math.cos(r[2] * RAD));
      L.rectangle([[r[2] - dy, r[3] - dx], [r[2] + dy, r[3] + dx]], { stroke: false, fillColor: D.taxa[r[0]][3] ? '#2e6b30' : '#c27a17', fillOpacity: 0.3, interactive: false }).addTo(lagen.b);
    });
    D.bomen.forEach(function (b) { L.circleMarker([b[2], b[3]], { radius: 3, stroke: false, fillColor: D.taxa[b[0]][3] ? '#2e6b30' : '#c27a17', fillOpacity: 0.8, interactive: false }).addTo(lagen.b); });
    map.on('click', function (e) {
      if (!kiesModus) return;
      var p = [e.latlng.lat, e.latlng.lng], b = dichtsteStand(p, 40);
      if (!b) { melding('Geen boom uit de collectie binnen 40 m van die plek. Tik dichter bij een bol of rechthoek.', true); return; }
      w().stops.push(stopVan(b.ti, b.s)); berekenRoute(); toon(); zetKies(false);
      melding('Stop toegevoegd: <i>' + esc(TAX[b.ti].n) + '</i> (' + esc(stLabel(b.s)) + '). Pas titel en uitleg aan in de lijst.');
    });
    tekenKaart();
  }
  function zetKies(aan) { kiesModus = aan; $('b-stopkaart').classList.toggle('aan', aan); $('b-stopkaart').textContent = aan ? 'Tik nu op de kaart bij een boom…' : 'Stop toevoegen (tik op de kaart)'; }

  // ------------------------------------------------------------ opname omzetten
  function importeerOpname(o) {
    var x = { id: uniekId(slug(o.naam || 'opname')), titel: o.naam || 'Opgenomen wandeling', kleur: '#AD1457', seizoen: '', intro: '', soort: 'thema', start: START, stops: [], route: [], lengte: 0 };
    (o.stops || []).forEach(function (s) {
      var b = dichtsteStand([s.lat, s.lon], 60);
      if (b) { var st = stopVan(b.ti, b.s); st.tekst = s.notitie || ''; x.stops.push(st); }
    });
    var tr = (o.punten || []).map(function (p) { return [p[0], p[1]]; });
    if (tr.length > 1) {
      x.route = [[START.lat, START.lon]].concat(afst(tr[0], [START.lat, START.lon]) > 30 ? pad([START.lat, START.lon], tr[0]).p.slice(1) : [], tr);
      if (afst(tr[tr.length - 1], [START.lat, START.lon]) > 30) x.route = x.route.concat(pad(tr[tr.length - 1], [START.lat, START.lon]).p.slice(1));
      x.route = x.route.map(function (p) { return [+(+p[0]).toFixed(6), +(+p[1]).toFixed(6)]; }); x.routeBron = 'opname'; x.lengte = lengte(x.route);
    }
    W.push(x); cur = W.length - 1;
    if (!x.route.length) berekenRoute();
    lijstWandelingen(); toon();
    melding('Opname omgezet: ' + x.stops.length + ' stops, de route volgt je GPS-spoor. Geef de stops een titel en uitleg en publiceer.');
  }
  function uniekId(b) { var id = b, n = 2; while (W.some(function (x) { return x.id === id; })) id = b + '-' + n++; return id; }

  // ------------------------------------------------------------ foto's
  function verklein(file) {
    var max = 1400;
    var laad = window.createImageBitmap ? createImageBitmap(file, { imageOrientation: 'from-image' }) : new Promise(function (ok, nok) {
      var im = new Image(); im.onload = function () { ok(im); }; im.onerror = nok; im.src = URL.createObjectURL(file);
    });
    return laad.then(function (im) {
      var f = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * f); c.height = Math.round(im.height * f);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.8);
    });
  }
  function ghHeaders() { return { Authorization: 'Bearer ' + lees('arb-gh-token', ''), Accept: 'application/vnd.github+json' }; }
  function laadFotoOp(wid, data) {
    var pad = 'img/wandelingen/' + wid + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.jpg';
    return fetch('https://api.github.com/repos/' + REPO + '/contents/' + pad, { method: 'PUT', headers: ghHeaders(),
      body: JSON.stringify({ message: 'Foto bij wandeling ' + wid, content: data.split(',')[1], branch: TAK }) })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + ' ' + t.slice(0, 120)); }); return pad; });
  }
  function voegFotosToe(x, s, files) {
    s.fotos = s.fotos || [];
    var lijst = [].slice.call(files), sleutel = !!lees('arb-gh-token', '');
    melding('Foto' + (lijst.length > 1 ? "'s" : '') + ' verwerken…');
    lijst.reduce(function (p, f) {
      return p.then(function () { return verklein(f); }).then(function (data) {
        if (!sleutel) { s.fotos.push({ src: data, bijschrift: '' }); return; }
        return laadFotoOp(x.id, data).then(function (pad) { s.fotos.push({ src: pad, bijschrift: '' }); })
          .catch(function (e) { s.fotos.push({ src: data, bijschrift: '' }); melding('Opladen lukte nog niet (' + esc(e.message) + '); de foto wordt opgeladen bij Publiceren.', true); });
      });
    }, Promise.resolve()).then(function () {
      toon();
      melding(sleutel ? 'Foto toegevoegd. Vergeet niet op <b>Publiceren</b> te tikken, dan verschijnt ze bij de stop.' :
        'Foto toegevoegd aan het concept. Ze wordt opgeladen bij <b>Publiceren</b> (daarvoor is de GitHub-sleutel nodig).');
    }).catch(function () { melding('Deze foto kon niet gelezen worden.', true); });
  }
  function laadOpenstaandeFotosOp() {
    var taken = [];
    W.forEach(function (x) { x.stops.forEach(function (s) { (s.fotos || []).forEach(function (f) { if (f.src.indexOf('data:') === 0) taken.push([x, f]); }); }); });
    return taken.reduce(function (p, t) { return p.then(function () { return laadFotoOp(t[0].id, t[1].src).then(function (pad) { t[1].src = pad; }); }); }, Promise.resolve());
  }

  // ------------------------------------------------------------ bewaren en publiceren
  function bewaarConcept() {
    try { localStorage.setItem('arb-beheer-concept', JSON.stringify({ t: Date.now(), W: W })); }
    catch (e) { melding('Het concept is te groot om op dit toestel te bewaren (te veel nieuwe foto\'s). Publiceer nu, dan staan ze veilig online.', true); }
  }
  function utf8b64(s) { return btoa(unescape(encodeURIComponent(s))); }
  function publiceer() {
    leesFormulier();
    var token = lees('arb-gh-token', ''); if (!token) { melding('Vul eerst je GitHub-sleutel in (onderaan, bij "Publiceren instellen").', true); $('gh').open = true; return; }
    var api = 'https://api.github.com/repos/' + REPO + '/contents/' + PAD, h = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
    melding('Publiceren…');
    laadOpenstaandeFotosOp().then(function () { return fetch(api + '?ref=' + TAK, { headers: h, cache: 'no-store' }); }).then(function (r) { if (!r.ok) throw new Error('lezen: ' + r.status); return r.json(); }).then(function (f) {
      var inhoud = JSON.stringify(W);
      return fetch(api, { method: 'PUT', headers: h, body: JSON.stringify({ message: 'Wandelingen bijgewerkt via de beheerpagina', content: utf8b64(inhoud), sha: f.sha, branch: TAK }) });
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + ' ' + t.slice(0, 160)); });
      melding('Gepubliceerd. Binnen een à twee minuten staat de nieuwe versie online (daarna één keer verversen).'); toon();
    }).catch(function (e) { melding('Publiceren mislukt: ' + esc(e.message) + '. Controleer je sleutel (rechten: Contents, lezen en schrijven, op deze repository).', true); });
  }
  function download() {
    leesFormulier();
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(W, null, 1)], { type: 'application/json' })); a.download = 'wandelingen.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500);
  }

  // ------------------------------------------------------------ opstart
  function init() {
    indexeer(); bouwGraaf();
    var c = lees('arb-beheer-concept', null);
    $('concept').hidden = !c;
    if (c) $('conceptinfo').textContent = 'Er is een niet-gepubliceerd concept van ' + new Date(c.t).toLocaleString('nl-BE') + ' op dit toestel.';
    $('b-concept').onclick = function () { W = c.W; cur = 0; lijstWandelingen(); toon(); $('concept').hidden = true; melding('Concept geladen.'); };
    $('b-online').onclick = function () { localStorage.removeItem('arb-beheer-concept'); location.reload(); };
    lijstWandelingen(); startKaart(); toon();
    $('wkeuze').onchange = function () { leesFormulier(); cur = +this.value; toon(); };
    ['f-titel', 'f-kleur', 'f-seizoen', 'f-intro', 'f-soort', 'f-folder', 'f-verborgen', 'f-rodedraad', 'f-praktisch', 'f-afsluiter', 't-kop', 't-tekst', 't-datum', 't-uur', 't-prijs', 't-duur', 't-inschrijven', 't-meebrengen'].forEach(function (id) { $(id).addEventListener('change', function () { leesFormulier(); lijstWandelingen(); toon(); }); });
    $('stops').addEventListener('input', wijzigStop); $('stops').addEventListener('change', wijzigStop); $('stops').addEventListener('click', stopKnop);
    $('b-nieuw').onclick = function () {
      leesFormulier();
      var t = prompt('Naam van de nieuwe wandeling?', 'Nieuwe wandeling'); if (t === null) return;
      W.push({ id: uniekId(slug(t)), titel: t || 'Nieuwe wandeling', kleur: KLEUREN[W.length % KLEUREN.length], seizoen: '', intro: '', soort: 'thema', start: START, stops: [], route: [[START.lat, START.lon]], lengte: 0 });
      cur = W.length - 1; lijstWandelingen(); toon(); zetKies(true);
    };
    $('b-kopie').onclick = function () { leesFormulier(); var x = JSON.parse(JSON.stringify(w())); x.id = uniekId(x.id + '-kopie'); x.titel += ' (kopie)'; x.soort = 'thema'; W.push(x); cur = W.length - 1; lijstWandelingen(); toon(); };
    $('b-weg').onclick = function () { if (!confirm('Wandeling "' + w().titel + '" verwijderen? (pas definitief na publiceren)')) return; W.splice(cur, 1); cur = 0; lijstWandelingen(); toon(); };
    $('b-op').onclick = function () { if (cur > 0) { var t = W[cur - 1]; W[cur - 1] = W[cur]; W[cur] = t; cur--; lijstWandelingen(); bewaarConcept(); } };
    $('b-neer').onclick = function () { if (cur < W.length - 1) { var t = W[cur + 1]; W[cur + 1] = W[cur]; W[cur] = t; cur++; lijstWandelingen(); bewaarConcept(); } };
    $('b-stopkaart').onclick = function () { zetKies(!kiesModus); if (kiesModus) $('bkaart').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    $('b-route').onclick = function () { berekenRoute(); toon(); melding('Route opnieuw berekend langs de paden, in de volgorde van de stops.'); };
    $('b-opt').onclick = function () { if (confirm('De stops in de kortste volgorde zetten (vanaf Eikestraat 102)?')) { optimaliseer(); toon(); } };
    $('b-opname').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      f.text().then(function (t) { importeerOpname(JSON.parse(t)); }).catch(function () { melding('Dit bestand kon niet gelezen worden.', true); });
      e.target.value = '';
    };
    $('b-publiceer').onclick = publiceer; $('b-download').onclick = download;
    $('gh-token').value = lees('arb-gh-token', '') ? '••••••••' : '';
    $('gh-bewaar').onclick = function () { var v = $('gh-token').value.trim(); if (v && v.indexOf('•') < 0) { schrijf('arb-gh-token', v); $('gh-token').value = '••••••••'; melding('Sleutel bewaard op dit toestel.'); } };
    $('gh-wis').onclick = function () { localStorage.removeItem('arb-gh-token'); $('gh-token').value = ''; melding('Sleutel gewist van dit toestel.'); };
  }
  Promise.all(['data/arboretum.json', 'data/wandelingen.json', 'data/padgraaf.json'].map(function (u) { return fetch(ROOT + u, { cache: 'no-cache' }).then(function (r) { return r.json(); }); }))
    .then(function (x) {
      D = x[0]; W = x[1]; PG = x[2];
      W.forEach(function (w_) { if (!w_.start) w_.start = START; });
      if (window.L && L.map) init(); else window.addEventListener('leaflet-klaar', init, { once: true });
    }).catch(function (e) { melding('Gegevens konden niet geladen worden: ' + esc(e.message), true); });
})();
