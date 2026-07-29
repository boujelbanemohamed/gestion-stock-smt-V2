// Gabarit commun aux bordereaux imprimés (mouvement, consolidé, liste).
//
// Deux contraintes ont dicté cette mise en page :
//
// 1. Chrome ajoute de lui-même un en-tête (date, titre du document) et un pied
//    (URL — « about:blank » pour une fenêtre ouverte sans adresse — et numéro de
//    page). `@page { margin: 0 }` les supprime.
//
// 2. Il faut alors redessiner nous-mêmes l'adresse et la numérotation. Ni un
//    pied en `position: fixed` (il ne réserve pas sa place et le contenu vient
//    buter dessus au saut de page) ni un `<tfoot>` (il se colle sous le contenu
//    sur la dernière feuille) ne conviennent. Les pages sont donc composées
//    explicitement par le script ci-dessous : hauteur fixe, pied en bas, et
//    découpage maîtrisé des tableaux trop longs.

export const ADRESSE_SOCIETE = "Centre urbain Nord, Sana Center, bloc C – 1082, Tunis"

export const STYLES_IMPRESSION = `
  @page { size: A4; margin: 0; }
  html, body { margin: 0; }
  body { font-family: Arial, sans-serif; color: #1e293b; }

  .page { position: relative; width: 210mm; height: 297mm; padding: 16mm;
          box-sizing: border-box; break-after: page; page-break-after: always;
          overflow: hidden; }
  .page:last-child { break-after: auto; page-break-after: auto; }
  .page-contenu { height: calc(297mm - 32mm - 18mm); overflow: hidden; }
  .page-pied { position: absolute; left: 16mm; right: 16mm; bottom: 12mm;
               display: flex; justify-content: space-between; align-items: center;
               border-top: 1px solid #cbd5e1; padding-top: 6px;
               font-size: 11px; color: #64748b; }
  .page-adresse { flex: 1; text-align: center; }

  .entete { display: flex; align-items: center; gap: 20px;
            border-bottom: 2px solid #1e293b; padding-bottom: 15px; }
  .entete img { max-height: 70px; max-width: 150px; object-fit: contain; }
  .entete h1 { margin: 0; font-size: 24px; }
  .entete .secours { display: none; width: 150px; height: 70px; background: #1e293b;
                     color: #fff; align-items: center; justify-content: center;
                     font-weight: bold; border-radius: 4px; }

  .titre-document { margin-top: 20px; text-align: center; }
  .titre-document h2 { margin: 0; font-size: 19px; }
  .info-gauche { margin-top: 14px; font-size: 13px; color: #475569; }
  .info-gauche p { margin: 0 0 3px; }
  .info-gauche .numero { font-size: 15px; color: #0f172a; margin-bottom: 5px; }

  section { padding-top: 6mm; }
  h3.section { margin: 0 0 10px; font-size: 15px; color: #1e293b;
               border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }

  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: left;
           vertical-align: top; }
  th { background: #f1f5f9; font-weight: bold; }
  .num { text-align: right; }
  .valeur { color: #1d4ed8; }
  .libelle { width: 42%; font-weight: bold; }
  tr.ligne-total td { background: #f1f5f9; font-weight: bold; }
  tr.sous-total td { background: #f8fafc; font-style: italic; color: #475569; }

  .destinataire { padding-top: 8mm; margin-top: 6mm; border-top: 2px solid #1e293b; }
  .destinataire h3 { margin: 0 0 18px; font-size: 15px; }
  .ligne-champs { display: flex; gap: 30px; margin-bottom: 16px; }
  .champ { flex: 1; }
  .champ p { font-weight: bold; margin: 0 0 5px; font-size: 12px; color: #374151; }
  .trait { border-bottom: 2px solid #1e293b; height: 24px; }
  .signature { margin-top: 24px; text-align: right; }
  .signature p { font-weight: bold; font-size: 12px; color: #374151; margin: 0 0 50px; }
`

// Composition des pages. Exécuté dans la fenêtre d'impression avant window.print().
export const SCRIPT_PAGINATION = `
(function () {
  var MM = 96 / 25.4;
  var HAUTEUR_PAGE = Math.round(297 * MM);
  var MARGE = Math.round(16 * MM);
  var HAUTEUR_PIED = Math.round(18 * MM);

  var source = document.getElementById("source");
  var sortie = document.getElementById("pages");
  var adresse = source.getAttribute("data-adresse");
  var hauteurUtile = HAUTEUR_PAGE - 2 * MARGE - HAUTEUR_PIED;
  var contenu;

  function nouvellePage() {
    var page = document.createElement("div");
    page.className = "page";
    page.innerHTML = '<div class="page-contenu"></div>' +
      '<div class="page-pied"><span class="page-adresse"></span><span class="page-numero"></span></div>';
    page.querySelector(".page-adresse").textContent = adresse;
    sortie.appendChild(page);
    return page.querySelector(".page-contenu");
  }

  function deborde() { return contenu.scrollHeight > hauteurUtile; }

  // Découpe un tableau ligne à ligne. Chaque morceau reprend l'en-tête de
  // colonnes ; à partir du deuxième, le titre annonce « Suite du tableau ... »
  // pour que le lecteur ne perde pas le fil.
  function placerTableau(section) {
    var titre = section.querySelector("h3").textContent;
    var origine = section.querySelector("table");
    var lignes = Array.prototype.slice.call(origine.tBodies[0].rows);
    // Ce qui sépare le titre du tableau (une description, par exemple) n'a de
    // sens qu'en tête de section : on le reporte sur le premier morceau.
    var intro = [];
    for (var n = section.querySelector("h3").nextSibling; n && n !== origine; n = n.nextSibling) {
      intro.push(n);
    }
    var premier = true;
    var i = 0;

    while (i < lignes.length) {
      var bloc = document.createElement("section");
      var h = document.createElement("h3");
      h.className = "section";
      h.textContent = premier ? titre : "Suite du tableau « " + titre + " »";
      bloc.appendChild(h);
      if (premier) {
        for (var k = 0; k < intro.length; k += 1) bloc.appendChild(intro[k].cloneNode(true));
      }

      var table = document.createElement("table");
      if (origine.tHead) table.appendChild(origine.tHead.cloneNode(true));
      var corps = document.createElement("tbody");
      table.appendChild(corps);
      bloc.appendChild(table);
      contenu.appendChild(bloc);

      var placee = 0;
      while (i < lignes.length) {
        corps.appendChild(lignes[i].cloneNode(true));
        if (deborde() && placee > 0) { corps.removeChild(corps.lastChild); break; }
        i += 1;
        placee += 1;
      }

      premier = false;
      if (i < lignes.length) contenu = nouvellePage();
    }
  }

  contenu = nouvellePage();
  var blocs = Array.prototype.slice.call(source.children);
  for (var b = 0; b < blocs.length; b += 1) {
    var bloc = blocs[b];
    contenu.appendChild(bloc);
    var hauteurBloc = bloc.getBoundingClientRect().height;
    if (!deborde()) continue;

    contenu.removeChild(bloc);
    var estTableau = bloc.tagName === "SECTION" && bloc.querySelector("table");

    // Le bloc tiendrait seul sur une page : on le reporte entier plutôt que de
    // le couper — un tableau ne se scinde jamais sans nécessité.
    if (hauteurBloc <= hauteurUtile) {
      contenu = nouvellePage();
      contenu.appendChild(bloc);
      continue;
    }

    // Plus haut qu'une page entière : le découpage est inévitable. On commence
    // sur la page courante, sinon on laisserait une feuille à moitié vide.
    if (estTableau) placerTableau(bloc);
    else contenu.appendChild(bloc);
  }

  var pages = sortie.querySelectorAll(".page");
  for (var p = 0; p < pages.length; p += 1) {
    pages[p].querySelector(".page-numero").textContent = "Page " + (p + 1) + "/" + pages.length;
  }
  source.parentNode.removeChild(source);
  document.documentElement.setAttribute("data-pages", pages.length);
})();
`

export function enteteHtml(logoPath: string): string {
  return `
    <div class="entete">
      <img src="${logoPath}" alt="Logo Société Monétique Tunisie"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <div class="secours">SMT</div>
      <h1>Société Monétique Tunisie</h1>
    </div>`
}

/**
 * Assemble le document imprimable. `blocs` est la suite des éléments de premier
 * niveau : le paginateur les répartit sur les feuilles.
 */
export function documentImprimable(options: {
  titreOnglet: string
  blocs: string
  impressionAutomatique?: boolean
}): string {
  const impression = options.impressionAutomatique === false ? "" : "window.print();"
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <title>${options.titreOnglet}</title>
    <style>${STYLES_IMPRESSION}</style>
  </head>
  <body>
    <div id="pages"></div>
    <div id="source" data-adresse="Adresse : ${ADRESSE_SOCIETE}">
      ${options.blocs}
    </div>
    <script>
      window.onload = function () {
        ${SCRIPT_PAGINATION}
        ${impression}
      };
    </script>
  </body>
</html>`
}
