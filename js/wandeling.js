// Wandelingen tonen uit data/wandelingen.json: wandelpagina (?w=…), lijsten en het kader op de plantenfiches.
(function () {
  'use strict';
  var ROOT = document.body.dataset.root || '../';
  var EIKEN = 'https://eiken-plants4you.netlify.app/eiken/';
  var P = window.PLAT || null;   // projectie van de plattegrond (door de pagina gezet)
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function naam(n) {
    n = esc(n || ''); if (n === 'onbekend') return n;
    return '<i>' + n.replace(/(\s(?:subsp|var|f|cv)\.\s|\s[x×]\s|\s(?:species)$)/g, function (m) { return '</i>' + m + '<i>'; }) + '</i>';
  }
  function fotos(s) {
    if (!s.fotos || !s.fotos.length) return '';
    return '<div class="sfotos">' + s.fotos.map(function (f) {
      return '<figure><a href="' + ROOT + esc(f.src) + '" target="_blank"><img src="' + ROOT + esc(f.src) + '" alt="' + esc(f.bijschrift || s.titel) + '" loading="lazy"></a>' + (f.bijschrift || f.bron ? '<figcaption>' + esc(f.bijschrift || '') + (f.bron ? ' <a class="fbron" href="' + esc(f.bron) + '" target="_blank" rel="noopener">bron</a>' : '') + '</figcaption>' : '') + '</figure>';
    }).join('') + '</div>';
  }
  window.ARB_FOTOS = fotos;
  function alineas(t) { return String(t || '').split(/\n\s*\n/).map(function (a) { return '<p>' + esc(a.trim()) + '</p>'; }).join(''); }
  function gids(s) {
    var h = '';
    if (s.verhaal) h += '<div class="gb vertel"><b>Vertel</b>' + alineas(s.verhaal) + '</div>';
    if (s.kijk) h += '<div class="gb kijk"><b>Kijk en wijs aan</b>' + alineas(s.kijk) + '</div>';
    if (s.weetje) h += '<div class="gb weetje"><b>Weetje</b>' + alineas(s.weetje) + '</div>';
    if (s.geo) h += '<div class="gb geo"><b>Diepe tijd</b>' + tijdbalk(s.geo.ma) + (s.geo.moment ? '<p class="muted"><span class="nr">' + s.geo.moment + '</span>Moment ' + s.geo.moment + ': ' + esc(s.geo.momenttitel) + '</p>' : '') + '<p>' + esc(s.geo.tekst) + '</p><p class="muted"><a href="' + ROOT + 'tijdlijn/">Alle boomgeslachten op de geologische tijdschaal</a></p></div>';
    if (s.doe) h += '<div class="gb doe"><b>Doe-opdracht</b>' + alineas(s.doe) + '</div>';
    if (s.samen) h += '<div class="gb samen"><b>Samen praten (jong en oud)</b>' + alineas(s.samen) + '</div>';
    if (s.vraag) h += '<div class="gb vraag"><b>Vraag aan de groep</b><p>' + esc(s.vraag) + '</p>' + (s.antwoord ? '<details><summary>Antwoord</summary><p>' + esc(s.antwoord) + '</p></details>' : '') + '</div>';
    if (s.k1923) h += '<div class="gb k1923"><b>Op de kaart van 1923</b><p>' + esc(s.k1923) + '</p></div>';
    if (s.brug) h += '<div class="gb brug"><b>Brug naar de volgende stop</b><p>' + esc(s.brug) + '</p></div>';
    if (!h) return '';
    return '<details class="gids" open><summary>Gidstekst</summary>' + h + '</details>';
  }
  function meer(s) {
    if (!s.meer || !s.meer.length) return '';
    return '<p class="meer">Meer weten: ' + s.meer.map(function (m) { return '<a href="' + esc(m.u) + '" target="_blank" rel="noopener">' + esc(m.t) + '</a>'; }).join(' · ') + '</p>';
  }
  window.ARB_GIDS = gids;
  function tijdbalk(ma) {
    var P_ = [['Trias', 251.9, 201.4, '#b98bb0'], ['Jura', 201.4, 143.1, '#6fb7c9'], ['Krijt', 143.1, 66, '#8cc66b'], ['Paleogeen', 66, 23, '#f2a65e'], ['Neog.', 23, 2.6, '#f4d35e'], ['Kw.', 2.6, 0, '#f6efb0']];
    var X = function (m) { return 10 + (230 - m) / 230 * 380; };
    var h = '<svg class="tijdbalk" viewBox="0 0 400 58" role="img" aria-label="Geologische tijdschaal met de oudste fossielen rond ' + ma + ' miljoen jaar">';
    P_.forEach(function (p) { var a = X(Math.min(p[1], 230)), b = X(p[2]); h += '<rect x="' + a.toFixed(1) + '" y="20" width="' + (b - a).toFixed(1) + '" height="16" fill="' + p[3] + '"/>' + (b - a > 30 ? '<text x="' + ((a + b) / 2).toFixed(1) + '" y="31.5" font-size="9" text-anchor="middle" fill="#333">' + p[0] + '</text>' : ''); });
    [200, 150, 100, 50, 0].forEach(function (m) { h += '<text x="' + X(m).toFixed(1) + '" y="49" font-size="8" text-anchor="middle" fill="#666">' + (m ? m + ' mln j' : 'nu') + '</text>'; });
    var x = X(ma);
    h += '<path d="M' + x.toFixed(1) + ' 38 L' + x.toFixed(1) + ' 18" stroke="#b71c1c" stroke-width="2"/><circle cx="' + x.toFixed(1) + '" cy="13" r="5" fill="#b71c1c"/><text x="' + Math.min(Math.max(x, 40), 360).toFixed(1) + '" y="8" font-size="9" text-anchor="middle" fill="#b71c1c">± ' + ma + ' miljoen jaar</text>';
    return h + '<rect x="' + X(0) + '" y="20" width="2" height="16" fill="#333"/></svg>';
  }
  window.ARB_TIJDBALK = tijdbalk;
  function km(m) { return (Math.round(m / 100) / 10).toFixed(1).replace('.', ','); }
  function xy(lat, lon) { return [(lon - P.lon0) * P.kx, (P.lat1 - lat) * P.ky]; }
  // ------------------------------------------------------------ de 40 geografische zones
  var Z = window.ZONES || null;
  function inRing(p, r) { var c = false; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { if (((r[i][0] > p[0]) !== (r[j][0] > p[0])) && (p[1] < (r[j][1] - r[i][1]) * (p[0] - r[i][0]) / (r[j][0] - r[i][0]) + r[i][1])) c = !c; } return c; }
  function zoneVan(lat, lon) { if (!Z) return null; for (var k in Z) { if (Z[k].r.some(function (r) { return inRing([lat, lon], r); })) return +k; } return null; }
  function zoneMidden(z) { var best = null, opp = -1; z.r.forEach(function (r) { var a = 0, cx = 0, cy = 0; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { var f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f; } if (Math.abs(a) > opp && a) { opp = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; } }); return best; }
  function zonesLangs(w) {
    var gez = {}, volg = [];
    function voeg(z) { if (z && !gez[z]) { gez[z] = 1; volg.push(z); } }
    w.route.forEach(function (p, i) { if (i % 2 === 0) voeg(zoneVan(p[0], p[1])); });
    w.stops.forEach(function (s) { var m = /^(\d+)/.exec(s.g || ''); voeg(m ? +m[1] : zoneVan(s.lat, s.lon)); });
    return volg;
  }
  function zonesSvg(w) {
    if (!Z) return '';
    var langs = zonesLangs(w), s = '';
    Object.keys(Z).forEach(function (k) {
      var oud = +k > 20, aan = langs.indexOf(+k) >= 0;
      Z[k].r.forEach(function (r) { s += '<polygon points="' + r.map(function (p) { var q = xy(p[0], p[1]); return q[0].toFixed(0) + ',' + q[1].toFixed(0); }).join(' ') + '" fill="' + (oud ? '#bcaaa4' : '#80cbc4') + '" fill-opacity="' + (aan ? 0.38 : 0.16) + '" stroke="' + (oud ? '#6d4c41' : '#00695c') + '" stroke-width="' + (aan ? 4 : 2) + '" stroke-opacity=".7"/>'; });
    });
    langs.forEach(function (k) {
      var m = zoneMidden(Z[k]); if (!m) return; var q = xy(m[0], m[1]), kl = k > 20 ? '#4e342e' : '#004d40';
      s += '<g><rect x="' + (q[0] - 25).toFixed(0) + '" y="' + (q[1] - 20).toFixed(0) + '" width="50" height="38" rx="9" fill="#fff" fill-opacity=".92" stroke="' + kl + '" stroke-width="3.5"/><text x="' + q[0].toFixed(0) + '" y="' + (q[1] + 9).toFixed(0) + '" font-size="26" font-weight="800" text-anchor="middle" fill="' + kl + '" font-family="system-ui,sans-serif">' + k + '</text><title>Zone ' + k + ': ' + esc(Z[k].t) + '</title></g>';
    });
    return s;
  }
  function zonesLijst(w) {
    if (!Z) return '';
    var langs = zonesLangs(w); if (!langs.length) return '';
    return '<div class="zonelijst"><b>Onderweg wandel je door ' + langs.length + ' zones</b> (in de volgorde van de route):<ol>' + langs.map(function (k) { return '<li value="' + k + '"><a href="' + ROOT + 'groep/' + k + '/">' + esc(Z[k].t) + '</a> <span class="muted">' + (k > 20 ? 'Oude Wereld' : 'Nieuwe Wereld') + '</span></li>'; }).join('') + '</ol><p class="muted">Op de kaart: groen = Nieuwe Wereld (zones 1-20), bruin = Oude Wereld (21-40); de zones langs deze wandeling zijn donkerder en hebben een nummer in een wit kader.</p></div>';
  }
  window.ARB_ZONE = function (g) { var m = /^(\d+)/.exec(g || ''); return m && Z && Z[m[1]] ? Z[m[1]].t : ''; };
  function kaartje(w) {
    if (!P) return '';
    var s = '<svg viewBox="' + P.vb + '" style="position:absolute;inset:0;width:100%;height:100%">';
    s += zonesSvg(w);
    s += '<polyline points="' + w.route.map(function (p) { var q = xy(p[0], p[1]); return q[0].toFixed(0) + ',' + q[1].toFixed(0); }).join(' ') + '" fill="none" stroke="' + w.kleur + '" stroke-width="12" stroke-linejoin="round" opacity=".8"/>';
    w.stops.forEach(function (st, i) {
      var q = xy(st.lat, st.lon);
      s += '<circle cx="' + q[0].toFixed(0) + '" cy="' + q[1].toFixed(0) + '" r="24" fill="' + w.kleur + '" stroke="#fff" stroke-width="5"/><text x="' + q[0].toFixed(0) + '" y="' + (q[1] + 9).toFixed(0) + '" font-size="26" font-weight="700" fill="#fff" text-anchor="middle" font-family="system-ui,sans-serif">' + (i + 1) + '</text>';
    });
    var b = xy(w.start.lat, w.start.lon);
    s += '<rect x="' + (b[0] - 26).toFixed(0) + '" y="' + (b[1] - 26).toFixed(0) + '" width="52" height="52" rx="8" fill="#0b4a45" stroke="#fff" stroke-width="5"/><text x="' + b[0].toFixed(0) + '" y="' + (b[1] + 10).toFixed(0) + '" font-size="28" font-weight="700" fill="#fff" text-anchor="middle" font-family="system-ui,sans-serif">S</text></svg>';
    return '<div style="position:relative"><img class="plat" src="' + ROOT + 'img/plattegrond.svg" alt="Plattegrond met de route en de 40 geografische zones">' + s + '</div>' + zonesLijst(w);
  }
  function pagina(w, el) {
    document.title = w.titel + ' | Arboretum Tervuren';
    var h = '<div style="--kl:' + w.kleur + '"><p class="crumb"><a href="' + ROOT + 'wandelingen/">Wandelingen</a>' + (w.soort === 'officieel' ? ' › bewegwijzerde lus' : '') + '</p><h1>' + esc(w.titel) + '</h1>';
    h += '<p class="muted">' + w.stops.length + ' stops · ongeveer ' + km(w.lengte) + ' km' + (w.folder ? ' · bewegwijzerd: ' + esc(w.folder) : '') + (w.seizoen ? ' · beste periode: ' + esc(w.seizoen) : '') + '</p>';
    if (w.intro) h += '<p class="tekst">' + esc(w.intro) + '</p>';
    if (w.rodedraad) h += '<div class="gb rood"><b>Rode draad</b>' + alineas(w.rodedraad) + '</div>';
    if (w.praktisch) h += '<div class="gb prak"><b>Voor de gids</b>' + alineas(w.praktisch) + '</div>';
    h += '<div class="knoppen"><a class="knop hoofd" href="' + ROOT + 'kaart/?w=' + w.id + '">Start de wandeling op de kaart (met GPS)</a>' +
      '<a class="knop" href="' + ROOT + 'teaser/?w=' + w.id + '">Teaser om te verspreiden</a>' +
      '<a class="knop" href="' + ROOT + 'folder/?w=' + w.id + '">Zakgids om af te drukken</a>' +
      '<a class="knop" href="' + ROOT + 'quiz/?w=' + w.id + '">Quiz na afloop</a>' +
      '<a class="knop" href="' + ROOT + 'feedback/?w=' + w.id + '">Feedbackformulier</a>' +
      '<a class="knop" href="' + ROOT + 'aandenken/?w=' + w.id + '">Aandenken: bladwijzer en certificaat</a>' +
      (/kinderen|families/.test(w.id) ? '<a class="knop" href="' + ROOT + 'speurkaart/">Speurkaart, bingo en paspoort</a>' : '') +
      (w.stops.some(function (x) { return x.verhaal; }) ? '<button type="button" class="knop" id="gidsknop">Gidsteksten dichtklappen</button>' : '') + '</div>';
    h += '<p class="waar"><b>Start en einde:</b> ' + esc(w.start.naam) + ' (boswachterswoningen, ingang Eikestraat). <a href="https://www.google.com/maps/dir/?api=1&amp;destination=' + w.start.lat + ',' + w.start.lon + '">Route ernaartoe</a></p>';
    h += kaartje(w);
    if (w.startverhaal) { var v = w.startverhaal; h += '<section class="startst" id="stop-0"><p class="hfst">' + esc(v.hoofdstuk || 'Vertrek') + '</p><h3><span class="snr">S</span>' + esc(v.titel) + '</h3>' + (v.tekst ? '<p class="tekst">' + esc(v.tekst) + '</p>' : '') + fotos(v) + gids(v) + meer(v) + '</section>'; }
    h += '<ol class="stops">';
    w.stops.forEach(function (s, k) {
      var q = '?w=' + w.id + '&amp;s=' + k;
      h += '<li id="stop-' + (k + 1) + '">' + (s.hoofdstuk ? '<p class="hfst">' + esc(s.hoofdstuk) + '</p>' : '') + '<h3>' + esc(s.titel) + '</h3><p>' + (s.n ? naam(s.n) : '<span class="muted">' + esc(s.plaats || 'plek') + '</span>') + (s.nl && s.nl !== s.titel ? ' · ' + esc(s.nl) : '') +
        (s.n ? ' <span class="muted">· groep ' + esc(s.g || '–') + (window.ARB_ZONE(s.g) ? ' (' + esc(window.ARB_ZONE(s.g)) + ')' : '') + (s.j ? ', geplant ' + s.j : '') + (s.om ? ', omtrek ' + s.om + ' cm' : '') + '</span>' : '') + '</p>' +
        (s.tekst ? '<p class="tekst">' + esc(s.tekst) + '</p>' : '') + fotos(s) + gids(s) + meer(s) +
        '<p>' + (s.slug ? '<a href="' + ROOT + 'soort/' + s.slug + '/' + q + '">Plantenfiche</a> · ' : '') + (s.eik ? '<a href="' + EIKEN + s.eik + '/">Eikfiche</a> · ' : '') +
        '<a href="' + ROOT + 'kaart/?w=' + w.id + '&amp;ll=' + s.lat + ',' + s.lon + '">op de kaart</a></p></li>';
    });
    h += '</ol>' + (w.afsluiter ? '<div class="gb rood"><b>Afsluiter</b>' + alineas(w.afsluiter) + '</div>' : '') + '<p class="waar">Terug naar het vertrekpunt: ' + esc(w.start.naam) + '.</p>';
    if (w.soort === 'officieel') h += '<p class="bron">Route: bewegwijzerde wandellus uit de wandelfolder van het Geografisch Arboretum Tervuren (arboretum-tervuren.be), overgenomen op de kaart; stops en teksten: deze gids. Volg ter plaatse de bewegwijzering.</p>';
    else h += '<p class="bron">De route volgt zo veel mogelijk de paden van de arboretumkaart; waar geen pad gekend is, is de lijn recht getrokken. Volg ter plaatse altijd de bestaande paden.</p>';
    el.innerHTML = h + '</div>';
    var gk = document.getElementById('gidsknop');
    if (gk) gk.addEventListener('click', function () {
      var open = gk.textContent.indexOf('dicht') >= 0;
      el.querySelectorAll('details.gids').forEach(function (d) { d.open = !open; });
      gk.textContent = open ? 'Gidsteksten openklappen' : 'Gidsteksten dichtklappen';
    });
    if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(function () { t.scrollIntoView(); }, 50); }
  }
  function regel(w, pre) {
    return '<li><a href="' + pre + 'wandeling/?w=' + w.id + '" style="--kl:' + w.kleur + '"><b>' + esc(w.titel) + '</b><span>' + w.stops.length + ' stops · ± ' + km(w.lengte) + ' km' +
      (w.soort === 'officieel' ? ' · ' + esc(w.folder) : ' · ' + esc(w.seizoen || '')) + '</span></a></li>';
  }
  function lijsten(W) {
    document.querySelectorAll('[data-wandellijst]').forEach(function (el) {
      var soort = el.dataset.wandellijst, pre = el.dataset.pre || ROOT;
      var l = W.filter(function (w) { return !w.verborgen && (soort === 'alle' || (w.soort || 'thema') === soort); });
      el.innerHTML = l.map(function (w) { return regel(w, pre); }).join('') || '<li class="los">Nog geen wandelingen.</li>';
    });
  }
  function ficheKader(W) {
    var el = document.getElementById('in-wandelingen'); if (!el) return;
    var n = el.dataset.n, h = '';
    W.forEach(function (w) {
      if (w.verborgen) return;
      w.stops.forEach(function (s, i) {
        if (s.n !== n) return;
        h += '<div class="dash"><b>In ' + esc(w.titel) + '</b> (stop ' + (i + 1) + (s.titel ? ': ' + esc(s.titel) : '') + ')' + (s.tekst ? '<p class="tekst">' + esc(s.tekst) + '</p>' : '') +
          '<a href="' + ROOT + 'wandeling/?w=' + w.id + '#stop-' + (i + 1) + '">Naar de wandeling</a></div>';
      });
    });
    el.innerHTML = h;
  }
  function kort(t, n) {   // eerste n zinnen
    var z = String(t || '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["”]?/g) || [String(t || '')];
    return z.slice(0, n).join(' ').trim();
  }
  function folder(w, el) {
    var url = location.origin + location.pathname.replace(/folder\/.*$/, '') + 'wandeling/?w=' + w.id;
    var kind = /kinderen|families/.test(w.id);
    document.title = 'Zakgids: ' + w.titel;
    var sv = w.startverhaal || {};
    var h = '<div class="knoppen geenprint"><button type="button" class="knop hoofd" onclick="window.print()">Afdrukken of opslaan als pdf</button><a class="knop" href="' + ROOT + 'wandeling/?w=' + w.id + '">Terug naar de wandeling</a></div>' +
      '<p class="muted geenprint">Tip: druk recto-verso af op A4. Geef de zakgids mee aan wie zelfstandig wil wandelen, of als aandenken na een gidsbeurt.</p>' +
      '<article class="zakgids" style="--kl:' + w.kleur + '"><header class="zkop"><p class="tlabel">Geografisch Arboretum Tervuren · zelf op pad</p><h1>' + esc(w.titel) + '</h1>' +
      '<p>' + esc(w.intro || '') + '</p><p class="zfeit"><b>Start en einde:</b> ' + esc(w.start.naam) + ' (ingang Eikestraat) · <b>Afstand:</b> ± ' + km(w.lengte) + ' km · <b>Stops:</b> ' + w.stops.length +
      (w.teaser && w.teaser.duur ? ' · <b>Duur:</b> ' + esc(w.teaser.duur) : '') + '</p></header>' + kaartje(w);
    if (w.rodedraad) h += '<p class="zrood"><b>Waar gaat het over?</b> ' + esc(kort(w.rodedraad, 2)) + '</p>';
    if (sv.verhaal) h += '<p class="zstart"><b>Even vooraf.</b> ' + esc(kort(sv.verhaal, 3)) + '</p>';
    var antw = [];
    h += '<ol class="zstops">' + w.stops.map(function (s, i) {
      var r = '<li><h3><span class="snr">' + (i + 1) + '</span>' + esc(s.titel || s.nl || s.n) + '</h3>' +
        (s.n ? '<p class="zsoort">' + naam(s.n) + (s.nl ? ' · ' + esc(s.nl) : '') + (s.g ? ' · groep ' + esc(s.g) : '') + '</p>' : (s.plaats ? '<p class="zsoort">' + esc(s.plaats) + '</p>' : ''));
      r += '<p>' + esc(kort(s.verhaal || s.tekst, kind ? 2 : 3)) + '</p>';
      if (s.kijk) r += '<p class="zkijk"><b>Kijk:</b> ' + esc(kort(s.kijk, 2)) + '</p>';
      if (s.doe) r += '<p class="zdoe"><b>Doe:</b> ' + esc(kort(s.doe, 3)) + ' <span class="vinkje">☐</span></p>';
      if (s.vraag) { antw.push((i + 1) + '. ' + (s.antwoord || '')); r += '<p class="zvraag"><b>Vraag ' + (i + 1) + ':</b> ' + esc(s.vraag) + '</p>'; }
      return r + '</li>';
    }).join('') + '</ol>';
    if (w.afsluiter) h += '<p class="zrood"><b>Tot slot.</b> ' + esc(kort(w.afsluiter, 2)) + '</p>';
    if (antw.length) h += '<div class="zantw"><b>Antwoorden</b><ol>' + antw.map(function (a) { return '<li>' + esc(a.replace(/^\d+\.\s*/, '')) + '</li>'; }).join('') + '</ol></div>';
    h += '<p class="tlink">Meer verhalen, foto’s en GPS-kaart: ' + esc(url.replace(/^https?:\/\//, '')) + '</p>' +
      '<p class="muted">Blijf op de paden, pluk niets van de bomen en neem je afval mee. Bronnen: arboretum-tervuren.be en het boek <i>Geografisch Arboretum Tervuren. Een wereldreis rond bomen</i> (2020).</p></article>';
    el.innerHTML = h;
  }
  function teaser(w, el) {
    var t = w.teaser || {}, url = location.origin + location.pathname.replace(/teaser\/.*$/, '') + 'wandeling/?w=' + w.id;
    document.title = 'Teaser: ' + w.titel;
    var wanneer = [t.datum, t.uur ? 'vertrek ' + t.uur : ''].filter(Boolean).join(', ');
    var rij = function (k, v) { return v ? '<tr><th>' + k + '</th><td>' + v + '</td></tr>' : ''; };
    var tekst = (t.kop || w.titel) + '\n\n' + (t.tekst || w.intro || '') + '\n\n' +
      [wanneer && 'Wanneer: ' + wanneer, 'Start: ' + w.start.naam + ' (ingang Eikestraat)', 'Afstand: ± ' + km(w.lengte) + ' km', t.duur && 'Duur: ' + t.duur, t.prijs && 'Prijs: ' + t.prijs,
       t.inschrijven && 'Inschrijven: ' + t.inschrijven, t.meebrengen && 'Meebrengen: ' + t.meebrengen].filter(Boolean).join('\n') + '\n\nMeer info: ' + url;
    var h = '<article class="teaser" style="--kl:' + w.kleur + '">' + (t.foto ? '<img class="tfoto" src="' + ROOT + esc(t.foto) + '" alt="">' : '') +
      '<p class="tlabel">Gidswandeling in het Geografisch Arboretum Tervuren</p><h1>' + esc(w.titel) + '</h1>' + (t.kop ? '<p class="tkop">' + esc(t.kop) + '</p>' : '') +
      '<p class="ttekst">' + esc(t.tekst || w.intro || '') + '</p><table class="tfeit">' +
      rij('Wanneer', esc(wanneer || 'Datum en uur volgen')) + rij('Start en einde', esc(w.start.naam) + ' (ingang Eikestraat)') +
      rij('Afstand', '± ' + km(w.lengte) + ' km') + rij('Duur', esc(t.duur || '')) + rij('Prijs', esc(t.prijs || '')) +
      rij('Inschrijven', esc(t.inschrijven || '')) + rij('Meebrengen', esc(t.meebrengen || '')) + '</table>' +
      '<p class="tlink">Meer info: <a href="' + esc(url) + '">' + esc(url.replace(/^https?:\/\//, '')) + '</a></p></article>' +
      '<div class="knoppen geenprint"><button type="button" class="knop hoofd" id="t-deel">Delen</button><button type="button" class="knop" id="t-kopie">Tekst kopiëren</button>' +
      '<button type="button" class="knop" id="t-print">Afdrukken of opslaan als pdf</button><a class="knop" href="' + ROOT + 'wandeling/?w=' + w.id + '">Naar de wandeling</a></div>' +
      '<p class="muted geenprint">Datum, uur, prijs en inschrijving pas je aan op de <a href="' + ROOT + 'beheer/">beheerpagina</a> (blok Teaser).</p>';
    el.innerHTML = h;
    document.getElementById('t-kopie').onclick = function () { navigator.clipboard.writeText(tekst).then(function () { document.getElementById('t-kopie').textContent = 'Gekopieerd'; }); };
    document.getElementById('t-print').onclick = function () { window.print(); };
    document.getElementById('t-deel').onclick = function () {
      if (navigator.share) navigator.share({ title: w.titel, text: tekst.replace('\n\nMeer info: ' + url, ''), url: url }).catch(function () {});
      else navigator.clipboard.writeText(tekst).then(function () { document.getElementById('t-deel').textContent = 'Tekst gekopieerd'; });
    };
  }
  fetch(ROOT + 'data/wandelingen.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (W) {
    var tp = document.getElementById('teaserpagina');
    if (tp) { var tid = new URLSearchParams(location.search).get('w'), tw = W.filter(function (x) { return x.id === tid; })[0]; if (tw) teaser(tw, tp); else tp.innerHTML = '<p>Wandeling niet gevonden. <a href="' + ROOT + 'wandelingen/">Alle wandelingen</a></p>'; }
    var fp = document.getElementById('folderpagina');
    if (fp) { var fid = new URLSearchParams(location.search).get('w'), fw = W.filter(function (x) { return x.id === fid; })[0]; if (fw) folder(fw, fp); else fp.innerHTML = '<p>Wandeling niet gevonden.</p>'; }
    var el = document.getElementById('wandelpagina');
    if (el) {
      var id = new URLSearchParams(location.search).get('w'), w = W.filter(function (x) { return x.id === id; })[0];
      if (w) pagina(w, el); else el.innerHTML = '<h1>Wandeling niet gevonden</h1><p><a href="' + ROOT + 'wandelingen/">Alle wandelingen</a></p>';
    }
    lijsten(W); ficheKader(W);
  });
})();
