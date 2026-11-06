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
    h += '<div class="knoppen"><a class="knop hoofd" href="' + ROOT + 'kaart/?w=' + w.id + '">Start de wandeling op de kaart (met GPS)</a></div>';
    h += '<p class="waar"><b>Start en einde:</b> ' + esc(w.start.naam) + ' (boswachterswoningen, ingang Eikestraat). <a href="https://www.google.com/maps/dir/?api=1&amp;destination=' + w.start.lat + ',' + w.start.lon + '">Route ernaartoe</a></p>';
    h += kaartje(w) + '<ol class="stops">';
    w.stops.forEach(function (s, k) {
      var q = '?w=' + w.id + '&amp;s=' + k;
      h += '<li id="stop-' + (k + 1) + '"><h3>' + esc(s.titel) + '</h3><p>' + naam(s.n) + (s.nl && s.nl !== s.titel ? ' · ' + esc(s.nl) : '') +
        ' <span class="muted">· groep ' + esc(s.g || '–') + (s.j ? ', geplant ' + s.j : '') + (s.om ? ', omtrek ' + s.om + ' cm' : '') + '</span></p>' +
        (s.tekst ? '<p class="tekst">' + esc(s.tekst) + '</p>' : '') +
        '<p><a href="' + ROOT + 'soort/' + s.slug + '/' + q + '">Plantenfiche</a> · ' + (s.eik ? '<a href="' + EIKEN + s.eik + '/">Eikfiche</a> · ' : '') +
        '<a href="' + ROOT + 'kaart/?w=' + w.id + '&amp;ll=' + s.lat + ',' + s.lon + '">op de kaart</a></p></li>';
    });
    h += '</ol><p class="waar">Terug naar het vertrekpunt: ' + esc(w.start.naam) + '.</p>';
    if (w.soort === 'officieel') h += '<p class="bron">Route: bewegwijzerde wandellus uit de wandelfolder van het Geografisch Arboretum Tervuren (arboretum-tervuren.be), overgenomen op de kaart; stops en teksten: deze gids. Volg ter plaatse de bewegwijzering.</p>';
    else h += '<p class="bron">De route volgt zo veel mogelijk de paden van de arboretumkaart; waar geen pad gekend is, is de lijn recht getrokken. Volg ter plaatse altijd de bestaande paden.</p>';
    el.innerHTML = h + '</div>';
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
  fetch(ROOT + 'data/wandelingen.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (W) {
    var el = document.getElementById('wandelpagina');
    if (el) {
      var id = new URLSearchParams(location.search).get('w'), w = W.filter(function (x) { return x.id === id; })[0];
      if (w) pagina(w, el); else el.innerHTML = '<h1>Wandeling niet gevonden</h1><p><a href="' + ROOT + 'wandelingen/">Alle wandelingen</a></p>';
    }
    lijsten(W); ficheKader(W);
  });
})();
