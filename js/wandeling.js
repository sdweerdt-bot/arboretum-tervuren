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
    if (s.vraag) h += '<div class="gb vraag"><b>Vraag aan de groep</b><p>' + esc(s.vraag) + '</p>' + (s.antwoord ? '<details><summary>Antwoord</summary><p>' + esc(s.antwoord) + '</p></details>' : '') + '</div>';
    if (s.brug) h += '<div class="gb brug"><b>Brug naar de volgende stop</b><p>' + esc(s.brug) + '</p></div>';
    if (!h) return '';
    return '<details class="gids" open><summary>Gidstekst</summary>' + h + '</details>';
  }
  function meer(s) {
    if (!s.meer || !s.meer.length) return '';
    return '<p class="meer">Meer weten: ' + s.meer.map(function (m) { return '<a href="' + esc(m.u) + '" target="_blank" rel="noopener">' + esc(m.t) + '</a>'; }).join(' · ') + '</p>';
  }
  window.ARB_GIDS = gids;
  function km(m) { return (Math.round(m / 100) / 10).toFixed(1).replace('.', ','); }
  function xy(lat, lon) { return [(lon - P.lon0) * P.kx, (P.lat1 - lat) * P.ky]; }
  function kaartje(w) {
    if (!P) return '';
    var s = '<svg viewBox="' + P.vb + '" style="position:absolute;inset:0;width:100%;height:100%">';
    s += '<polyline points="' + w.route.map(function (p) { var q = xy(p[0], p[1]); return q[0].toFixed(0) + ',' + q[1].toFixed(0); }).join(' ') + '" fill="none" stroke="' + w.kleur + '" stroke-width="12" stroke-linejoin="round" opacity=".8"/>';
    w.stops.forEach(function (st, i) {
      var q = xy(st.lat, st.lon);
      s += '<circle cx="' + q[0].toFixed(0) + '" cy="' + q[1].toFixed(0) + '" r="24" fill="' + w.kleur + '" stroke="#fff" stroke-width="5"/><text x="' + q[0].toFixed(0) + '" y="' + (q[1] + 9).toFixed(0) + '" font-size="26" font-weight="700" fill="#fff" text-anchor="middle" font-family="system-ui,sans-serif">' + (i + 1) + '</text>';
    });
    var b = xy(w.start.lat, w.start.lon);
    s += '<rect x="' + (b[0] - 26).toFixed(0) + '" y="' + (b[1] - 26).toFixed(0) + '" width="52" height="52" rx="8" fill="#0b4a45" stroke="#fff" stroke-width="5"/><text x="' + b[0].toFixed(0) + '" y="' + (b[1] + 10).toFixed(0) + '" font-size="28" font-weight="700" fill="#fff" text-anchor="middle" font-family="system-ui,sans-serif">S</text></svg>';
    return '<div style="position:relative"><img class="plat" src="' + ROOT + 'img/plattegrond.svg" alt="Plattegrond met de route">' + s + '</div>';
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
      (w.stops.some(function (x) { return x.verhaal; }) ? '<button type="button" class="knop" id="gidsknop">Gidsteksten dichtklappen</button>' : '') + '</div>';
    h += '<p class="waar"><b>Start en einde:</b> ' + esc(w.start.naam) + ' (boswachterswoningen, ingang Eikestraat). <a href="https://www.google.com/maps/dir/?api=1&amp;destination=' + w.start.lat + ',' + w.start.lon + '">Route ernaartoe</a></p>';
    h += kaartje(w);
    if (w.startverhaal) { var v = w.startverhaal; h += '<section class="startst" id="stop-0"><p class="hfst">' + esc(v.hoofdstuk || 'Vertrek') + '</p><h3><span class="snr">S</span>' + esc(v.titel) + '</h3>' + (v.tekst ? '<p class="tekst">' + esc(v.tekst) + '</p>' : '') + fotos(v) + gids(v) + meer(v) + '</section>'; }
    h += '<ol class="stops">';
    w.stops.forEach(function (s, k) {
      var q = '?w=' + w.id + '&amp;s=' + k;
      h += '<li id="stop-' + (k + 1) + '">' + (s.hoofdstuk ? '<p class="hfst">' + esc(s.hoofdstuk) + '</p>' : '') + '<h3>' + esc(s.titel) + '</h3><p>' + naam(s.n) + (s.nl && s.nl !== s.titel ? ' · ' + esc(s.nl) : '') +
        ' <span class="muted">· groep ' + esc(s.g || '–') + (s.j ? ', geplant ' + s.j : '') + (s.om ? ', omtrek ' + s.om + ' cm' : '') + '</span></p>' +
        (s.tekst ? '<p class="tekst">' + esc(s.tekst) + '</p>' : '') + fotos(s) + gids(s) + meer(s) +
        '<p><a href="' + ROOT + 'soort/' + s.slug + '/' + q + '">Plantenfiche</a> · ' + (s.eik ? '<a href="' + EIKEN + s.eik + '/">Eikfiche</a> · ' : '') +
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
    var el = document.getElementById('wandelpagina');
    if (el) {
      var id = new URLSearchParams(location.search).get('w'), w = W.filter(function (x) { return x.id === id; })[0];
      if (w) pagina(w, el); else el.innerHTML = '<h1>Wandeling niet gevonden</h1><p><a href="' + ROOT + 'wandelingen/">Alle wandelingen</a></p>';
    }
    lijsten(W); ficheKader(W);
  });
})();
