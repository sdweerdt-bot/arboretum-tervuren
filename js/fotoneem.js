// ---------------------------------------------------------------- eigen foto's bij een stop (ter plaatse nemen of kiezen)
// Met een GitHub-sleutel op dit toestel (ingesteld op de beheerpagina) gaat de foto meteen online bij de stop.
// Zonder sleutel blijft ze in een wachtrij op dit toestel; de beheerpagina neemt ze op in het concept en laadt ze op bij Publiceren.
(function () {
  'use strict';
  var REPO = 'sdweerdt-bot/arboretum-tervuren', PAD = 'data/wandelingen.json', TAK = 'main', ROOT = document.body.dataset.root || '../';
  function lees(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
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
  function b64utf8(b) { return decodeURIComponent(escape(atob(b.replace(/\s/g, '')))); }
  function utf8b64(s) { return btoa(unescape(encodeURIComponent(s))); }
  function zoekStop(W, wid, k, n, titel) {
    var x = W.filter(function (a) { return a.id === wid; })[0]; if (!x) return null;
    var s = x.stops[k];
    if (s && (s.n || '') === (n || '') && s.titel === titel) return s;
    return x.stops.filter(function (a) { return (a.n || '') === (n || '') && a.titel === titel; })[0] || null;
  }
  function online(token, item) {
    var h = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
    var pad = 'img/wandelingen/' + item.w + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.jpg';
    var api = 'https://api.github.com/repos/' + REPO + '/contents/';
    return fetch(api + pad, { method: 'PUT', headers: h, body: JSON.stringify({ message: 'Foto bij wandeling ' + item.w + ' (ter plaatse genomen)', content: item.data.split(',')[1], branch: TAK }) })
      .then(function (r) { if (!r.ok) throw new Error('foto: ' + r.status); return fetch(api + PAD + '?ref=' + TAK, { headers: h, cache: 'no-store' }); })
      .then(function (r) { if (!r.ok) throw new Error('lezen: ' + r.status); return r.json(); })
      .then(function (meta) {
        var inh = meta.content ? Promise.resolve(b64utf8(meta.content)) :
          fetch(api + PAD + '?ref=' + TAK, { headers: { Authorization: h.Authorization, Accept: 'application/vnd.github.raw' }, cache: 'no-store' }).then(function (r) { return r.text(); });
        return inh.then(function (t) {
          var W = JSON.parse(t), s = zoekStop(W, item.w, item.k, item.n, item.t);
          if (!s) throw new Error('stop niet gevonden');
          var foto = { src: pad, bijschrift: item.b || '', bron: 'Eigen foto' + (item.d ? ', ' + item.d : '') };
          (s.fotos = s.fotos || []).push(foto);
          // ook in de korte versie van deze wandeling, als die er is
          W.forEach(function (x) { if (x.variant_van === item.w) { var s2 = zoekStop(W, x.id, -1, item.n, item.t); if (s2) (s2.fotos = s2.fotos || []).push(foto); } });
          return fetch(api + PAD, { method: 'PUT', headers: h, body: JSON.stringify({ message: 'Eigen foto bij ' + item.w + ', stop ' + (item.k + 1), content: utf8b64(JSON.stringify(W)), sha: meta.sha, branch: TAK }) });
        });
      }).then(function (r) { if (!r.ok) throw new Error('bewaren: ' + r.status); return pad; });
  }
  function wachtrij() { return lees('arb-fotowachtrij', []); }
  function zetWachtrij(q) { localStorage.setItem('arb-fotowachtrij', JSON.stringify(q)); }
  window.ARB_FOTONEEM = function (el, w) {
    var q = wachtrij().filter(function (a) { return a.w === (w.variant_van || w.id); });
    if (q.length) {
      var p = document.createElement('p'); p.className = 'fotowacht';
      p.innerHTML = '📷 ' + q.length + ' eigen foto' + (q.length > 1 ? "'s" : '') + ' van deze wandeling wacht' + (q.length > 1 ? 'en' : '') + ' op dit toestel om opgeladen te worden. <a href="' + ROOT + 'beheer/">Open de beheerpagina</a> en tik op Publiceren.';
      var st = el.querySelector('.stops'); if (st) st.parentNode.insertBefore(p, st);
      q.forEach(function (a) { var kk = a.k >= 0 ? a.k : w.stops.findIndex(function (x) { return (x.n || '') === a.n && x.titel === a.t; }); var fs = document.getElementById('fs-' + kk); if (fs) fs.innerHTML = '<img class="fotomini" src="' + a.data + '" alt=""> wacht op opladen'; });
    }
    el.addEventListener('change', function (e) {
      var inp = e.target; if (!inp.dataset || inp.dataset.fotostop === undefined || !inp.files || !inp.files[0]) return;
      var k = +inp.dataset.fotostop, file = inp.files[0];
      inp.value = '';
      window.ARB_FOTO_VERWERK(w, k, file, document.getElementById('fs-' + k));
    });
  };
  window.ARB_FOTO_VERWERK = function (w, k, file, fs) {
      var s = w.stops[k];
      fs.textContent = 'Foto verwerken…';
      verklein(file).then(function (data) {
        var b = prompt('Korte beschrijving bij de foto (bv. "blad", "schors", "vrucht"). Mag leeg blijven.\nTip: geen herkenbare personen op de foto.', '');
        if (b === null) { fs.textContent = ''; return; }
        var item = { w: w.variant_van || w.id, k: w.variant_van ? -1 : k, n: s.n || '', t: s.titel, b: b.trim(), d: new Date().toLocaleDateString('nl-BE'), data: data };
        fs.innerHTML = '<img class="fotomini" src="' + data + '" alt=""> ';
        var token = lees('arb-gh-token', '');
        if (token) {
          fs.insertAdjacentHTML('beforeend', 'Opladen…');
          return online(token, item).then(function () {
            fs.innerHTML = '<img class="fotomini" src="' + data + '" alt=""> ✓ Opgeladen. Binnen een à twee minuten staat ze online bij deze stop.';
          }).catch(function (er) {
            var q = wachtrij(); q.push(item); try { zetWachtrij(q); } catch (x) {}
            fs.innerHTML = '<img class="fotomini" src="' + data + '" alt=""> Opladen lukte niet (' + esc(er.message) + '). De foto is bewaard op dit toestel; publiceer later via de beheerpagina.';
          });
        }
        var q = wachtrij(); q.push(item);
        try { zetWachtrij(q); fs.insertAdjacentHTML('beforeend', 'Bewaard op dit toestel. Open later de <a href="' + ROOT + 'beheer/">beheerpagina</a> en tik op Publiceren om ze online te zetten.'); }
        catch (x) { fs.insertAdjacentHTML('beforeend', 'Het geheugen van dit toestel is vol: publiceer eerst de wachtende foto\'s via de beheerpagina.'); }
      }).catch(function () { fs.textContent = 'Deze foto kon niet gelezen worden.'; });
  };
})();
